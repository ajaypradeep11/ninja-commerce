import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Order, OrderItem, OrderStatus } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { ListOrdersQuery } from './dto/list-orders.query';

type OrderWithItems = Order & { items: OrderItem[] };

const VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
  PAID: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
};

const REFUNDABLE: OrderStatus[] = ['PAID', 'SHIPPED', 'DELIVERED'];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  findForUser(uid: string): Promise<OrderWithItems[]> {
    return this.prisma.order.findMany({
      where: { userId: uid },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(query: ListOrdersQuery): Promise<{
    items: OrderWithItems[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { status, email, page = 1, pageSize = 20 } = query;
    const where: Prisma.OrderWhereInput = {
      ...(status ? { status } : {}),
      ...(email ? { email: { contains: email, mode: 'insensitive' as const } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string, requester: AuthUser): Promise<OrderWithItems> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!requester.admin && order.userId !== requester.uid) {
      throw new ForbiddenException('Not your order');
    }
    return order;
  }

  async updateStatus(
    id: string,
    status: 'SHIPPED' | 'DELIVERED',
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (!VALID_TRANSITIONS[order.status]?.includes(status)) {
      throw new ConflictException(
        `Cannot transition ${order.status} -> ${status}`,
      );
    }
    return this.prisma.order.update({ where: { id }, data: { status } });
  }

  async refund(id: string): Promise<{ refundId: string }> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (!REFUNDABLE.includes(order.status) || !order.stripePaymentIntentId) {
      throw new ConflictException('Order is not refundable');
    }
    const refund = await this.stripe.client.refunds.create({
      payment_intent: order.stripePaymentIntentId,
    });
    // Status flips to REFUNDED via the charge.refunded webhook.
    return { refundId: refund.id };
  }
}
