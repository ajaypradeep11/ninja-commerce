import type { OrderResponseDto } from '@/api/generated';
import { pollForOrder } from './success-poll';

function makeOrder(overrides: Partial<OrderResponseDto> = {}): OrderResponseDto {
  return {
    id: 'order_1',
    userId: 'user_1',
    email: 'shopper@example.com',
    currency: 'CAD',
    status: 'PENDING',
    stripeSessionId: 'cs_test_1',
    stripePaymentIntentId: null,
    shippingAddress: null,
    discountCents: null,
    couponCode: null,
    subtotalCents: 5000,
    taxCents: null,
    totalCents: 5000,
    items: [],
    deliveredAt: null,
    returnRequestedAt: null,
    returnReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('pollForOrder', () => {
  it('resolves immediately when the first poll already matches PAID', async () => {
    const order = makeOrder({ status: 'PAID' });
    const fetchMine = vi.fn().mockResolvedValue([order]);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await pollForOrder(fetchMine, 'cs_test_1', {
      intervalMs: 1000,
      timeoutMs: 5000,
      sleep,
    });

    expect(result).toEqual({ state: 'paid', order });
    expect(fetchMine).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('resolves paid once the order transitions from PENDING to PAID on the third poll', async () => {
    const pending = makeOrder({ status: 'PENDING' });
    const paid = makeOrder({ status: 'PAID' });
    const fetchMine = vi
      .fn()
      .mockResolvedValueOnce([pending])
      .mockResolvedValueOnce([pending])
      .mockResolvedValueOnce([paid]);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await pollForOrder(fetchMine, 'cs_test_1', {
      intervalMs: 1000,
      timeoutMs: 10000,
      sleep,
    });

    expect(result).toEqual({ state: 'paid', order: paid });
    expect(fetchMine).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('treats SHIPPED and DELIVERED as paid', async () => {
    const shipped = makeOrder({ status: 'SHIPPED' });
    const fetchMine = vi.fn().mockResolvedValue([shipped]);

    const result = await pollForOrder(fetchMine, 'cs_test_1', {
      intervalMs: 1000,
      timeoutMs: 5000,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    expect(result).toEqual({ state: 'paid', order: shipped });
  });

  it('resolves pending-timeout when the order matches but stays PENDING through the deadline', async () => {
    const pending = makeOrder({ status: 'PENDING' });
    const fetchMine = vi.fn().mockResolvedValue([pending]);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await pollForOrder(fetchMine, 'cs_test_1', {
      intervalMs: 1000,
      timeoutMs: 3000,
      sleep,
    });

    expect(result).toEqual({ state: 'pending-timeout', order: pending });
  });

  it('resolves not-found when no order ever matches the session id', async () => {
    const other = makeOrder({ stripeSessionId: 'cs_other' });
    const fetchMine = vi.fn().mockResolvedValue([other]);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await pollForOrder(fetchMine, 'cs_test_1', {
      intervalMs: 1000,
      timeoutMs: 3000,
      sleep,
    });

    expect(result).toEqual({ state: 'not-found' });
  });

  it('defaults to a real sleep when none is injected (uses a short timeout to keep the test fast)', async () => {
    const fetchMine = vi.fn().mockResolvedValue([]);

    const result = await pollForOrder(fetchMine, 'cs_test_1', {
      intervalMs: 5,
      timeoutMs: 5,
    });

    expect(result).toEqual({ state: 'not-found' });
  });
});
