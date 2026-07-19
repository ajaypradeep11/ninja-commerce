import { availableOrderActions } from './order-actions';

describe('availableOrderActions', () => {
  it('PENDING → can cancel only (unpaid)', () => {
    expect(availableOrderActions('PENDING')).toEqual({
      nextStatus: null,
      canRefund: false,
      canCancel: true,
    });
  });
  it('PAID → can ship, refund, and cancel', () => {
    expect(availableOrderActions('PAID')).toEqual({
      nextStatus: 'SHIPPED',
      canRefund: true,
      canCancel: true,
    });
  });
  it('SHIPPED → can deliver and refund, not cancel', () => {
    expect(availableOrderActions('SHIPPED')).toEqual({
      nextStatus: 'DELIVERED',
      canRefund: true,
      canCancel: false,
    });
  });
  it('DELIVERED → refund only', () => {
    expect(availableOrderActions('DELIVERED')).toEqual({
      nextStatus: null,
      canRefund: true,
      canCancel: false,
    });
  });
  it.each(['CANCELLED', 'REFUNDED'] as const)('%s → no actions', (status) => {
    expect(availableOrderActions(status)).toEqual({
      nextStatus: null,
      canRefund: false,
      canCancel: false,
    });
  });
});
