import {
  BadGatewayException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Currency } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CouponsService } from '../coupons/coupons.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { UsersService } from '../users/users.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

// Canada only. Stripe Tax computes the destination's sales tax from the
// address the customer enters on the hosted Checkout page.
const SHIPPING_COUNTRIES = ['CA'] as const;

// The shopper's chosen currency selects which price column we bill from. Both
// prices are set by hand in admin, so nothing is converted at request time.
const PRICE_COLUMN = {
  CAD: 'priceCents',
  USD: 'priceUsdCents',
} as const satisfies Record<Currency, 'priceCents' | 'priceUsdCents'>;

const unitAmountFor = (
  product: { priceCents: number; priceUsdCents: number },
  currency: Currency,
): number => product[PRICE_COLUMN[currency]];

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly users: UsersService,
    private readonly coupons: CouponsService,
    private readonly config: ConfigService,
  ) {}

  async createSession(
    user: AuthUser,
    dto: CreateCheckoutDto,
  ): Promise<{ url: string; orderId: string }> {
    const ids = dto.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) {
      throw new ConflictException(
        'Duplicate products in cart — merge quantities',
      );
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, active: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const lines = dto.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) {
        throw new NotFoundException(
          `Product ${item.productId} is not available`,
        );
      }
      if (product.stockQty < item.quantity) {
        throw new ConflictException(
          `Only ${product.stockQty} left of ${product.name}`,
        );
      }
      return { product, quantity: item.quantity };
    });

    await this.users.ensureUser(user.uid, user.email);

    const subtotalCents = lines.reduce(
      (sum, l) => sum + unitAmountFor(l.product, dto.currency) * l.quantity,
      0,
    );

    // Re-quote the coupon server-side (existence, active, once-per-customer,
    // discount math) — the cart's earlier /coupons/validate is advisory only.
    const quote = dto.couponCode
      ? await this.coupons.quoteForUser(
          user.uid,
          dto.couponCode,
          subtotalCents,
          dto.currency,
        )
      : null;

    const order = await this.prisma.order.create({
      data: {
        userId: user.uid,
        email: user.email,
        currency: dto.currency,
        subtotalCents,
        couponCode: quote?.coupon.code ?? null,
        discountCents: quote?.discountCents ?? null,
        items: {
          create: lines.map((l) => ({
            productId: l.product.id,
            name: l.product.name,
            priceCents: unitAmountFor(l.product, dto.currency),
            quantity: l.quantity,
          })),
        },
      },
    });

    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    try {
      // Our own coupon system replaces Stripe promotion codes (the two are
      // mutually exclusive on a session). The discount is an ad-hoc one-off
      // Stripe coupon for the exact amount we quoted.
      const discounts = quote
        ? [
            {
              coupon: (
                await this.stripe.client.coupons.create({
                  amount_off: quote.discountCents,
                  currency: dto.currency.toLowerCase(),
                  duration: 'once' as const,
                  name: quote.coupon.code,
                })
              ).id,
            },
          ]
        : undefined;

      const session = await this.stripe.client.checkout.sessions.create({
        mode: 'payment',
        customer_email: user.email,
        discounts,
        automatic_tax: { enabled: true },
        shipping_address_collection: {
          allowed_countries: [...SHIPPING_COUNTRIES],
        },
        line_items: lines.map((l) => ({
          quantity: l.quantity,
          price_data: {
            currency: dto.currency.toLowerCase(),
            unit_amount: unitAmountFor(l.product, dto.currency),
            product_data: { name: l.product.name },
            // Prices are tax-exclusive; Stripe Tax adds the destination tax on top.
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
