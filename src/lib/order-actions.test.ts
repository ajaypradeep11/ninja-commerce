import { availableOrderActions } from './order-actions';

describe('availableOrderActions', () => {
  it('PAID → can ship and refund', () => {
    expect(availableOrderActions('PAID')).toEqual({
      nextStatus: 'SHIPPED',
      canRefund: true,
    });
  });
  it('SHIPPED → can deliver and refund', () => {
    expect(availableOrderActions('SHIPPED')).toEqual({
      nextStatus: 'DELIVERED',
      canRefund: true,
    });
  });
  it('DELIVERED → refund only', () => {
    expect(availableOrderActions('DELIVERED')).toEqual({
      nextStatus: null,
      canRefund: true,
    });
  });
  it.each(['PENDING', 'CANCELLED', 'REFUNDED'] as const)(
    '%s → no actions',
    (status) => {
      expect(availableOrderActions(status)).toEqual({
        nextStatus: null,
        canRefund: false,
      });
    },
  );
});
