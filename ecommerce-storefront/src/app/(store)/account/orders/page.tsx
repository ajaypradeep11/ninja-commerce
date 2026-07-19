'use client';

import Link from 'next/link';
import { useMyOrders } from '@/api/hooks/account';
import { OrderCard } from '@/components/site/OrderCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrdersPage() {
  const { data: orders, isLoading, error, refetch } = useMyOrders();

  let content: React.ReactNode;
  if (isLoading) {
    content = <Skeleton className="h-40 w-full" />;
  } else if (error || !orders) {
    content = (
      <div className="py-12 text-center">
        <p className="text-ink/70">We couldn&rsquo;t load your orders.</p>
        <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  } else if (orders.length === 0) {
    content = (
      <div className="py-12 text-center">
        <p className="text-ink/70">No orders yet.</p>
        <Link
          href="/products"
          className="mt-4 inline-block text-brand underline underline-offset-4 hover:no-underline"
        >
          Start shopping
        </Link>
      </div>
    );
  } else {
    content = (
      <div>
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    );
  }

  // A white "island": scope a light theme so OrderCard's ink/border tokens
  // render as dark-on-white, standing out against the dark site theme.
  return (
    <div
      data-theme="atelier"
      className="mt-6 rounded-2xl bg-surface p-6 text-ink shadow-sm ring-1 ring-black/5 sm:p-8"
    >
      {content}
    </div>
  );
}
