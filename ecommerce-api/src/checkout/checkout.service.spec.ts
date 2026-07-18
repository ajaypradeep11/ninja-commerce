import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';

const user = { uid: 'u1', email: 'a@b.com', admin: false };

describe('CheckoutService', () => {
  let prisma: {
    product: { findMany: jest.Mock };
    order: { create: jest.Mock; update: jest.Mock };
  };
  let stripe: { client: { checkout: { sessions: { create: jest.Mock } } } };
  let users: { ensureUser: jest.Mock };
  let service: CheckoutService;

  beforeEach(() => {
    prisma = {
      product: { findMany: jest.fn() },
      order: {
        create: jest.fn().mockResolvedValue({ id: 'o1' }),
        update: jest.fn().mockResolvedValue({ id: 'o1' }),
      },
    };
    stripe = { client: { checkout: { sessions: { create: jest.fn() } } } };
    users = { ensureUser: jest.fn().mockResolvedValue({ id: 'u1' }) };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
    };
    service = new CheckoutService(
      prisma as unknown as PrismaService,
      stripe as unknown as StripeService,
      users as unknown as UsersService,
      config as unknown as ConfigService,
    );
  });

  const tee = { id: 'p1', name: 'Tee', priceCents: 2500, stockQty: 10, active: true };

  it('rejects unknown or inactive products', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    await expect(
      service.createSession(user, { items: [{ productId: 'p1', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects insufficient stock with a friendly message', async () => {
    prisma.product.findMany.mockResolvedValue([{ ...tee, stockQty: 2 }]);
    await expect(
      service.createSession(user, { items: [{ productId: 'p1', quantity: 3 }] }),
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
    });
    expect(users.ensureUser).toHaveBeenCalledWith('u1', 'a@b.com');
    expect(prisma.order.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        email: 'a@b.com',
        subtotalCents: 5000,
        items: {
          create: [{ productId: 'p1', name: 'Tee', priceCents: 2500, quantity: 2 }],
        },
      },
    });
    const sessionArgs = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(sessionArgs.mode).toBe('payment');
    expect(sessionArgs.allow_promotion_codes).toBe(true);
    expect(sessionArgs.metadata).toEqual({ orderId: 'o1' });
    // Canada-only shipping and Stripe Tax compute provincial GST/HST/PST/QST.
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
    expect(result).toEqual({ url: 'https://stripe.test/session', orderId: 'o1' });
  });

  it('cancels the order and maps the failure to a 502 if Stripe session creation fails', async () => {
    prisma.product.findMany.mockResolvedValue([tee]);
    stripe.client.checkout.sessions.create.mockRejectedValue(new Error('stripe down'));
    await expect(
      service.createSession(user, { items: [{ productId: 'p1', quantity: 1 }] }),
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
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects insufficient stock with a 409 ConflictException (not swallowed by the Stripe failure mapping)', async () => {
    prisma.product.findMany.mockResolvedValue([{ ...tee, stockQty: 2 }]);
    await expect(
      service.createSession(user, { items: [{ productId: 'p1', quantity: 3 }] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
