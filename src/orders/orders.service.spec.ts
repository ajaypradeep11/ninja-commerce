import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';

describe('OrdersService', () => {
  let prisma: {
    order: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let stripe: { client: { refunds: { create: jest.Mock } } };
  let service: OrdersService;

  beforeEach(() => {
    prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    stripe = { client: { refunds: { create: jest.fn() } } };
    service = new OrdersService(
      prisma as unknown as PrismaService,
      stripe as unknown as StripeService,
    );
  });

  it('findForUser returns own orders newest first with items', async () => {
    await service.findForUser('u1');
    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findOne forbids other customers', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'owner' });
    await expect(
      service.findOne('o1', { uid: 'intruder', email: '', admin: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('findOne allows admin', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'owner' });
    await expect(
      service.findOne('o1', { uid: 'other', email: '', admin: true }),
    ).resolves.toMatchObject({ id: 'o1' });
  });

  it('findOne 404s on unknown order', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(
      service.findOne('nope', { uid: 'u', email: '', admin: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateStatus allows PAID -> SHIPPED', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'PAID' });
    prisma.order.update.mockResolvedValue({ id: 'o1', status: 'SHIPPED' });
    await service.updateStatus('o1', 'SHIPPED');
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'SHIPPED' },
    });
  });

  it('updateStatus rejects invalid transition PENDING -> SHIPPED', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'PENDING' });
    await expect(service.updateStatus('o1', 'SHIPPED')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refund calls Stripe with the payment intent', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'PAID',
      stripePaymentIntentId: 'pi_1',
    });
    stripe.client.refunds.create.mockResolvedValue({ id: 're_1' });
    const result = await service.refund('o1');
    expect(stripe.client.refunds.create).toHaveBeenCalledWith({
      payment_intent: 'pi_1',
    });
    expect(result).toEqual({ refundId: 're_1' });
  });

  it('refund rejects orders that are not paid yet', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'PENDING',
      stripePaymentIntentId: null,
    });
    await expect(service.refund('o1')).rejects.toBeInstanceOf(ConflictException);
  });
});
