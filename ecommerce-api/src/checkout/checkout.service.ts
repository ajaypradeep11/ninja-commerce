import {
  BadGatewayException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { UsersService } from '../users/users.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

// Canada-only shipping. Stripe Tax computes provincial GST/HST/PST/QST from the
// address the customer enters on the hosted Checkout page.
const SHIPPING_COUNTRIES = ['CA'] as const;
const CURRENCY = 'cad';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async createSession(
    user: AuthUser,
    dto: CreateCheckoutDto,
  ): Promise<{ url: string; orderId: string }> {
    const ids = dto.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) {
      throw new ConflictException('Duplicate products in cart — merge quantities');
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, active: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const lines = dto.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} is not available`);
      }
      if (product.stockQty < item.quantity) {
        throw new ConflictException(`Only ${product.stockQty} left of ${product.name}`);
      }
      return { product, quantity: item.quantity };
    });

    await this.users.ensureUser(user.uid, user.email);

    const subtotalCents = lines.reduce(
      (sum, l) => sum + l.product.priceCents * l.quantity,
      0,
    );
    const order = await this.prisma.order.create({
      data: {
        userId: user.uid,
        email: user.email,
        subtotalCents,
        items: {
          create: lines.map((l) => ({
            productId: l.product.id,
            name: l.product.name,
            priceCents: l.product.priceCents,
            quantity: l.quantity,
          })),
        },
      },
    });

    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    try {
      const session = await this.stripe.client.checkout.sessions.create({
        mode: 'payment',
        customer_email: user.email,
        allow_promotion_codes: true,
        automatic_tax: { enabled: true },
        shipping_address_collection: {
          allowed_countries: [...SHIPPING_COUNTRIES],
        },
        line_items: lines.map((l) => ({
          quantity: l.quantity,
          price_data: {
            currency: CURRENCY,
            unit_amount: l.product.priceCents,
            product_data: { name: l.product.name },
            // Prices are tax-exclusive; Stripe Tax adds the provincial tax on top.
            tax_behavior: 'exclusive',
          },
        })),
        metadata: { orderId: order.id },
        success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/cart`,
      });
      await this.prisma.order.update({
        where: { id: order.id },
        data: { stripeSessionId: session.id },
      });
      if (!session.url) throw new Error('Stripe session has no url');
      return { url: session.url, orderId: order.id };
    } catch (e) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });
      if (e instanceof HttpException) {
        throw e;
      }
      this.logger.error(
        `Stripe session creation failed for order ${order.id}`,
        e instanceof Error ? e.stack : String(e),
      );
      throw new BadGatewayException(
        'Payment provider error — please try again later',
      );
    }
  }
}
