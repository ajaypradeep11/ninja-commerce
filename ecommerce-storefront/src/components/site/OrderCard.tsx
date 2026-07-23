import Link from 'next/link';
import type { OrderResponseDto } from '@/api/generated';
import { OrderStatusBadge } from './OrderStatusBadge';
import { Price } from './Price';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function OrderCard({ order }: { order: OrderResponseDto }) {
  const total = order.totalCents ?? order.subtotalCents;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Link
      href={`/account/orders/${order.id}`}
      className="flex items-center justify-between gap-4 border-b border-ink/10 py-6 first:pt-0 hover:text-brand"
    >
      <div>
        <p className="font-mono text-sm text-ink">#{order.id.slice(0, 8)}</p>
        <p className="mt-1 text-sm text-ink/60">
          {formatDate(order.createdAt)}
        </p>
      </div>
      <OrderStatusBadge status={order.status} />
      <p className="text-sm text-ink/60">
        {itemCount} item{itemCount === 1 ? '' : 's'}
      </p>
      <Price cents={total} currency={order.currency} />
    </Link>
  );
}
