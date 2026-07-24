import {
  BadGatewayException,
  BadRequestException,
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
import { SettingsService } from '../settings/settings.service';
import { StripeService } from '../stripe/stripe.service';
import { UsersService } from '../users/users.service';
import { AddressDto } from '../users/dto/update-addresses.dto';
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

const shippingRate = (
  displayName: string,
  amountCents: number,
  currency: string,
  minDays: number,
  maxDays: number,
) => ({
  shipping_rate_data: {
    display_name: displayName,
    type: 'fixed_amount' as const,
    fixed_amount: { amount: amountCents, currency },
    // Prices are tax-exclusive; Stripe Tax adds the destination tax on top.
    tax_behavior: 'exclusive' as const,
    delivery_estimate: {
      minimum: { unit: 'business_day' as const, value: minDays },
      maximum: { unit: 'business_day' as const, value: maxDays },
    },
  },
});

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly users: UsersService,
    private readonly coupons: CouponsService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  private async stripeCustomerId(user: AuthUser): Promise<string> {
    const row = await this.prisma.user.findUnique({ where: { id: user.uid } });
    if (row?.stripeCustomerId) return row.stripeCustomerId;
    const customer = await this.stripe.client.customers.create({
      email: user.email,
    });
    await this.prisma.user.update({
      where: { id: user.uid },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  // Sets the chosen address as the customer's shipping so hosted Checkout
  // prefills it (fields stay editable there). Recovers if the stored customer
  // id no longer exists on Stripe (e.g. test/live key switch).
  private async customerWithShipping(
    user: AuthUser,
    address: AddressDto,
  ): Promise<string> {
    const shipping = {
      name: address.name ?? user.email,
      address: {
        line1: address.line1,
        line2: address.line2 ?? undefined,
        city: address.city,
        state: address.state ?? undefined,
        postal_code: address.postalCode,
        country: address.country,
      },
    };
    const customerId = await this.stripeCustomerId(user);
    try {
      await this.stripe.client.customers.update(customerId, { shipping });
      return customerId;
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== 'resource_missing') throw err;
      const fresh = await this.stripe.client.customers.create({
        email: user.email,
        shipping,
      });
      await this.prisma.user.update({
        where: { id: user.uid },
        data: { stripeCustomerId: fresh.id },
      });
      return fresh.id;
    }
  }

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

    if (dto.shippingAddress && dto.shippingAddress.country !== 'CA') {
      throw new BadRequestException(
        'Shipping is available within Canada only',
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

      const customerId = dto.shippingAddress
        ? await this.customerWithShipping(user, dto.shippingAddress)
        : null;

      const shippingSettings = await this.settings.getShippingSettings();
      const discountedSubtotalCents = subtotalCents - (quote?.discountCents ?? 0);
      const sessionCurrency = dto.currency.toLowerCase();
      const shippingOptions = [
        shippingRate(
          'Standard (4-7 business days)',
          discountedSubtotalCents >= shippingSettings.freeShippingThresholdCents
            ? 0
            : shippingSettings.standardShippingCents,
          sessionCurrency,
          4,
          7,
        ),
        shippingRate(
          'Expedited (2-4 business days)',
          shippingSettings.expeditedShippingCents,
          sessionCurrency,
          2,
          4,
        ),
      ];

      const session = await this.stripe.client.checkout.sessions.create({
        mode: 'payment',
        // With an existing customer + automatic_tax + address collection,
        // Stripe requires the collected shipping address to be saved back to
        // the customer (customer_update.shipping = 'auto') for tax math.
        ...(customerId
          ? {
              customer: customerId,
              customer_update: { shipping: 'auto' as const },
            }
          : { customer_email: user.email }),
        discounts,
        automatic_tax: { enabled: true },
        shipping_address_collection: {
          allowed_countries: [...SHIPPING_COUNTRIES],
        },
        shipping_options: shippingOptions,
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
