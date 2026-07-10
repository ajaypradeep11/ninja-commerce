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
}

export function availableOrderActions(status: OrderStatus): OrderActions {
  const nextStatus =
    status === 'PAID' ? 'SHIPPED' : status === 'SHIPPED' ? 'DELIVERED' : null;
  const canRefund =
    status === 'PAID' || status === 'SHIPPED' || status === 'DELIVERED';
  return { nextStatus, canRefund };
}
