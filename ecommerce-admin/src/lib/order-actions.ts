export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface OrderActions {
  nextStatus: 'SHIPPED' | 'DELIVERED' | null;
  canRefund: boolean;
  canCancel: boolean;
}

export function availableOrderActions(status: OrderStatus): OrderActions {
  const nextStatus =
    status === 'PAID' ? 'SHIPPED' : status === 'SHIPPED' ? 'DELIVERED' : null;
  const canRefund =
    status === 'PAID' || status === 'SHIPPED' || status === 'DELIVERED';
  // Cancellable only before shipping (paid cancel issues a refund).
  const canCancel = status === 'PENDING' || status === 'PAID';
  return { nextStatus, canRefund, canCancel };
}
