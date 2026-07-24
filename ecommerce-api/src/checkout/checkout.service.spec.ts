import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CouponsService } from '../coupons/coupons.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';

const user = { uid: 'u1', email: 'a@b.com', admin: false };

describe('CheckoutService', () => {
  let prisma: {
    product: { findMany: jest.Mock };
    order: { create: jest.Mock; update: jest.Mock };
  };
  let stripe: {
    client: {
      checkout: { sessions: { create: jest.Mock } };
      coupons: { create: jest.Mock };
    };
  };
  let users: { ensureUser: jest.Mock };
  let coupons: { quoteForUser: jest.Mock };
  let settings: { getShippingSettings: jest.Mock };
  let service: CheckoutService;

  beforeEach(() => {
    prisma = {
      product: { findMany: jest.fn() },
      order: {
        create: jest.fn().mockResolvedValue({ id: 'o1' }),
        update: jest.fn().mockResolvedValue({ id: 'o1' }),
      },
    };
    stripe = {
      client: {
        checkout: { sessions: { create: jest.fn() } },
        coupons: { create: jest.fn().mockResolvedValue({ id: 'stripe_c1' }) },
      },
    };
    users = { ensureUser: jest.fn().mockResolvedValue({ id: 'u1' }) };
    coupons = { quoteForUser: jest.fn() };
    settings = {
      getShippingSettings: jest.fn(),
    };
    settings.getShippingSettings.mockResolvedValue({
      id: 1,
      freeShippingThresholdCents: 6500,
      standardShippingCents: 999,
      expeditedShippingCents: 1499,
      updatedAt: new Date(),
    });
    const config = {
      getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
    };
    service = new CheckoutService(
      prisma as unknown as PrismaService,
      stripe as unknown as StripeService,
      users as unknown as UsersService,
      coupons as unknown as CouponsService,
      settings as unknown as SettingsService,
      config as unknown as ConfigService,
    );
  });

  const tee = {
    id: 'p1',
    name: 'Tee',
    priceCents: 2500,
    stockQty: 10,
    active: true,
  };

  it('applies a validated coupon as a one-off Stripe discount', async () => {
    prisma.product.findMany.mockResolvedValue([tee]);
    coupons.quoteForUser.mockResolvedValue({
      coupon: { id: 'c1', code: 'SAVE10', type: 'PERCENT', value: 10 },
      discountCents: 500,
    });
    stripe.client.checkout.sessions.create.mockResolvedValue({
      id: 'cs_1',
      url: 'https://stripe.test/session',
    });
    await service.createSession(user, {
      items: [{ productId: 'p1', quantity: 2 }],
      couponCode: 'SAVE10',
      currency: 'CAD',
    });
    expect(coupons.quoteForUser).toHaveBeenCalledWith(
      'u1',
      'SAVE10',
      5000,
      'CAD',
    );
    expect(prisma.order.create.mock.calls[0][0].data).toMatchObject({
      couponCode: 'SAVE10',
      discountCents: 500,
    });
    expect(stripe.client.coupons.create).toHaveBeenCalledWith({
      amount_off: 500,
      currency: 'cad',
      duration: 'once',
      name: 'SAVE10',
    });
    const sessionArgs = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(sessionArgs.discounts).toEqual([{ coupon: 'stripe_c1' }]);
    expect(sessionArgs.allow_promotion_codes).toBeUndefined();
  });

  it('rejects unknown or inactive products', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    await expect(
      service.createSession(user, {
        items: [{ productId: 'p1', quantity: 1 }],
        currency: 'CAD',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects insufficient stock with a friendly message', async () => {
    prisma.product.findMany.mockResolvedValue([{ ...tee, stockQty: 2 }]);
    await expect(
      service.createSession(user, {
        items: [{ productId: 'p1', quantity: 3 }],
        currency: 'CAD',
      }),
    ).rejects.toThrow('Only 2 left of Tee');
  });

  it('creates a pending order with snapshots and returns the session url', async () => {
    prisma.product.findMany.mockResolvedValue([tee]);
    stripe.client.checkout.sessions.create.mockResolvedValue({
      id: 'cs_1',
      url: 'https://stripe.test/session',
    });
    const result = await service.createSession(user, {
      items: [{ productId: 'p1', quantity: 2 }],
      currency: 'CAD',
    });
    expect(users.ensureUser).toHaveBeenCalledWith('u1', 'a@b.com');
    expect(prisma.order.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        email: 'a@b.com',
        currency: 'CAD',
        subtotalCents: 5000,
        couponCode: null,
        discountCents: null,
        items: {
          create: [
            { productId: 'p1', name: 'Tee', priceCents: 2500, quantity: 2 },
          ],
        },
      },
    });
    const sessionArgs = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(sessionArgs.mode).toBe('payment');
    // Our own coupon system replaces Stripe promotion codes.
    expect(sessionArgs.allow_promotion_codes).toBeUndefined();
    expect(sessionArgs.discounts).toBeUndefined();
    expect(sessionArgs.metadata).toEqual({ orderId: 'o1' });
    // Canada only; Stripe Tax computes the destination's sales tax.
    expect(sessionArgs.automatic_tax).toEqual({ enabled: true });
    expect(sessionArgs.shipping_address_collection.allowed_countries).toEqual([
      'CA',
    ]);
    expect(sessionArgs.line_items).toEqual([
      {
        quantity: 2,
        price_data: {
          currency: 'cad',
          unit_amount: 2500,
          product_data: { name: 'Tee' },
          tax_behavior: 'exclusive',
        },
      },
    ]);
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { stripeSessionId: 'cs_1' },
    });
    expect(result).toEqual({
      url: 'https://stripe.test/session',
      orderId: 'o1',
    });
  });

  it('cancels the order and maps the failure to a 502 if Stripe session creation fails', async () => {
    prisma.product.findMany.mockResolvedValue([tee]);
    stripe.client.checkout.sessions.create.mockRejectedValue(
      new Error('stripe down'),
    );
    await expect(
      service.createSession(user, {
        items: [{ productId: 'p1', quantity: 1 }],
        currency: 'CAD',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'CANCELLED' },
    });
  });

  it('rejects duplicate product ids in one cart', async () => {
    await expect(
      service.createSession(user, {
        items: [
          { productId: 'p1', quantity: 1 },
          { productId: 'p1', quantity: 2 },
        ],
        currency: 'CAD',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects insufficient stock with a 409 ConflictException (not swallowed by the Stripe failure mapping)', async () => {
    prisma.product.findMany.mockResolvedValue([{ ...tee, stockQty: 2 }]);
    await expect(
      service.createSession(user, {
        items: [{ productId: 'p1', quantity: 3 }],
        currency: 'CAD',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('builds a USD session from the USD price and stamps the order', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Lamp', priceCents: 5499, priceUsdCents: 3999, stockQty: 10, active: true },
    ]);
    stripe.client.checkout.sessions.create.mockResolvedValue({
      id: 'cs_1',
      url: 'https://stripe.test/session',
    });

    await service.createSession(user, {
      items: [{ productId: 'p1', quantity: 2 }],
      currency: 'USD',
    });

    const session = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(session.line_items[0].price_data.currency).toBe('usd');
    expect(session.line_items[0].price_data.unit_amount).toBe(3999);

    const order = prisma.order.create.mock.calls[0][0].data;
    expect(order.currency).toBe('USD');
    expect(order.subtotalCents).toBe(7998);
    expect(order.items.create[0].priceCents).toBe(3999);
  });

  it('builds a CAD session from the CAD price', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Lamp', priceCents: 5499, priceUsdCents: 3999, stockQty: 10, active: true },
    ]);
    stripe.client.checkout.sessions.create.mockResolvedValue({
      id: 'cs_1',
      url: 'https://stripe.test/session',
    });

    await service.createSession(user, {
      items: [{ productId: 'p1', quantity: 1 }],
      currency: 'CAD',
    });

    const session = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(session.line_items[0].price_data.currency).toBe('cad');
    expect(session.line_items[0].price_data.unit_amount).toBe(5499);
  });

  it('ships only to Canada regardless of billing currency', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Lamp', priceCents: 5499, priceUsdCents: 3999, stockQty: 10, active: true },
    ]);
    stripe.client.checkout.sessions.create.mockResolvedValue({
      id: 'cs_1',
      url: 'https://stripe.test/session',
    });

    await service.createSession(user, {
      items: [{ productId: 'p1', quantity: 1 }],
      currency: 'USD',
    });

    const session = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(session.shipping_address_collection.allowed_countries).toEqual([
      'CA',
    ]);
  });

  it('pins coupon currency to USD when applying a USD PERCENT coupon', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Lamp', priceCents: 5499, priceUsdCents: 3999, stockQty: 10, active: true },
    ]);
    coupons.quoteForUser.mockResolvedValue({
      coupon: { id: 'c1', code: 'SAVE20', type: 'PERCENT', value: 20 },
      discountCents: 800,
    });
    stripe.client.checkout.sessions.create.mockResolvedValue({
      id: 'cs_1',
      url: 'https://stripe.test/session',
    });

    await service.createSession(user, {
      items: [{ productId: 'p1', quantity: 2 }],
      couponCode: 'SAVE20',
      currency: 'USD',
    });

    expect(coupons.quoteForUser).toHaveBeenCalledWith(
      'u1',
      'SAVE20',
      7998,
      'USD',
    );
    expect(stripe.client.coupons.create).toHaveBeenCalledWith({
      amount_off: 800,
      currency: 'usd',
      duration: 'once',
      name: 'SAVE20',
    });
  });

  const expectedRate = (
    name: string,
    amount: number,
    min: number,
    max: number,
    currency = 'cad',
  ) => ({
    shipping_rate_data: {
      display_name: name,
      type: 'fixed_amount',
      fixed_amount: { amount, currency },
      tax_behavior: 'exclusive',
      delivery_estimate: {
        minimum: { unit: 'business_day', value: min },
        maximum: { unit: 'business_day', value: max },
      },
    },
  });

  it('charges standard and expedited shipping below the free threshold', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Tee', priceCents: 2500, priceUsdCents: 1900, stockQty: 5, active: true },
    ]);
    stripe.client.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/session' });

    await service.createSession(user, { items: [{ productId: 'p1', quantity: 1 }], currency: 'CAD' });

    const session = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(session.shipping_options).toEqual([
      expectedRate('Standard (4-7 business days)', 999, 4, 7),
      expectedRate('Expedited (2-4 business days)', 1499, 2, 4),
    ]);
  });

  it('makes standard free at the threshold while expedited stays paid', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Lamp', priceCents: 6500, priceUsdCents: 4900, stockQty: 5, active: true },
    ]);
    stripe.client.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/session' });

    await service.createSession(user, { items: [{ productId: 'p1', quantity: 1 }], currency: 'CAD' });

    const session = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(session.shipping_options).toEqual([
      expectedRate('Standard (4-7 business days)', 0, 4, 7),
      expectedRate('Expedited (2-4 business days)', 1499, 2, 4),
    ]);
  });

  it('uses the post-coupon subtotal for the free-shipping threshold', async () => {
    // 70.00 cart with a 10.00 coupon → 60.00 discounted → below 65.00 → paid shipping
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Lamp', priceCents: 7000, priceUsdCents: 4900, stockQty: 5, active: true },
    ]);
    coupons.quoteForUser.mockResolvedValue({
      coupon: { id: 'c1', code: 'SAVE10', type: 'FIXED', value: 1000 },
      discountCents: 1000,
    });
    stripe.client.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/session' });

    await service.createSession(user, {
      items: [{ productId: 'p1', quantity: 1 }],
      currency: 'CAD',
      couponCode: 'SAVE10',
    });

    const session = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(session.shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(999);
  });
});
