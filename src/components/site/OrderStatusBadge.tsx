import type { OrderStatus } from '@/api/generated';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> =
  {
    PENDING: { label: 'Awaiting payment', className: 'text-ink/60' },
    PAID: { label: 'Paid', className: 'bg-subtle text-ink' },
    SHIPPED: { label: 'Shipped', className: 'bg-subtle text-ink' },
    DELIVERED: { label: 'Delivered', className: 'bg-subtle text-ink' },
    CANCELLED: { label: 'Cancelled', className: 'text-ink/40' },
    REFUNDED: { label: 'Refunded', className: 'text-highlight' },
  };

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, className } = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-block w-fit rounded-full px-2 py-0.5 font-mono text-xs tracking-wide',
        className,
      )}
    >
      {label}
    </span>
  );
}
