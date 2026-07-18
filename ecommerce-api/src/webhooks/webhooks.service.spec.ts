import { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';

type Tx = {
  processedStripeEvent: { create: jest.Mock };
  order: {
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    findFirst: jest.Mock;
  };
  product: { updateMany: jest.Mock };
};

function makeTx(): Tx {
  return {
    processedStripeEvent: { create: jest.fn() },
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
}

const shippingDetails = {
  name: 'Ship To Person',
  address: { country: 'CA', city: 'Toronto' },
};
const billingDetails = { address: { country: 'US' }, name: 'A B' };

function completedEvent(
  overrides: {
    payment_status?: string;
    collected_information?: unknown;
  } = {},
): Stripe.Event {
  return {
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_1',
        metadata: { orderId: 'o1' },
        payment_intent: 'pi_1',
        amount_total: 5650,
        total_details: { amount_tax: 650 },
        payment_status: 'paid',
        customer_details: billingDetails,
        collected_information: { shipping_details: shippingDetails },
        ...overrides,
      },
    },
  } as unknown as Stripe.Event;
}

describe('WebhooksService', () => {
  let tx: Tx;
  let prisma: { $transaction: jest.Mock };
  let service: WebhooksService;

  beforeEach(() => {
    tx = makeTx();
    prisma = {
      $transaction: jest.fn((cb: (t: Tx) => Promise<void>) => cb(tx)),
    };
    service = new WebhooksService(prisma as unknown as PrismaService);
  });

  it('skips duplicate events (P2002 on processed-event insert)', async () => {
    tx.processedStripeEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.$transaction.mockImplementation(
      async (cb: (t: Tx) => Promise<void>) => {
        await cb(tx); // create throws inside, service must swallow P2002
      },
    );
    await expect(
      service.handleEvent(completedEvent()),
    ).resolves.toBeUndefined();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('marks order paid and decrements stock atomically', async () => {
    tx.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'PENDING',
      subtotalCents: 5000,
      items: [{ productId: 'p1', quantity: 2 }],
    });
    await service.handleEvent(completedEvent());
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', stockQty: { gte: 2 } },
      data: { stockQty: { decrement: 2 } },
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: expect.objectContaining({
        status: 'PAID',
        stripePaymentIntentId: 'pi_1',
        totalCents: 5650,
        taxCents: 650,
        shippingAddress: shippingDetails,
      }),
    });
  });

  it('does not mark the order paid when payment_status is not paid (e.g. pending async payment)', async () => {
    tx.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'PENDING',
      subtotalCents: 5000,
      items: [{ productId: 'p1', quantity: 2 }],
    });
    await service.handleEvent(completedEvent({ payment_status: 'unpaid' }));
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('does not double-process an already-paid order', async () => {
    tx.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'PAID',
      items: [],
    });
    await service.handleEvent(completedEvent());
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('logs stock shortfall but still marks paid', async () => {
    tx.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'PENDING',
      subtotalCents: 5000,
      items: [{ productId: 'p1', quantity: 2 }],
    });
    tx.product.updateMany.mockResolvedValue({ count: 0 });
    await service.handleEvent(completedEvent());
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );
  });

  it('cancels pending order on session expiry', async () => {
    const event = {
      id: 'evt_2',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_1', metadata: { orderId: 'o1' } } },
    } as unknown as Stripe.Event;
    await service.handleEvent(event);
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  });

  it('refund restores stock and marks order refunded', async () => {
    tx.order.findFirst.mockResolvedValue({
      id: 'o1',
      status: 'PAID',
      items: [{ productId: 'p1', quantity: 2 }],
    });
    const event = {
      id: 'evt_3',
      type: 'charge.refunded',
      data: {
        object: { id: 'ch_1', payment_intent: 'pi_1', refunded: true },
      },
    } as unknown as Stripe.Event;
    await service.handleEvent(event);
    expect(tx.order.findFirst).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_1' },
      include: { items: true },
    });
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { stockQty: { increment: 2 } },
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'REFUNDED' },
    });
  });

  it('ignores partial refunds (charge.refunded === false)', async () => {
    tx.order.findFirst.mockResolvedValue({
      id: 'o1',
      status: 'PAID',
      items: [{ productId: 'p1', quantity: 2 }],
    });
    const event = {
      id: 'evt_3b',
      type: 'charge.refunded',
      data: {
        object: { id: 'ch_2', payment_intent: 'pi_1', refunded: false },
      },
    } as unknown as Stripe.Event;
    await service.handleEvent(event);
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('ignores unhandled event types without touching the db', async () => {
    const event = {
      id: 'evt_4',
      type: 'payment_intent.created',
      data: { object: {} },
    } as unknown as Stripe.Event;
    await service.handleEvent(event);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
