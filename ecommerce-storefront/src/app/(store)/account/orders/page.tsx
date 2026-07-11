'use client';

import Link from 'next/link';
import { useMyOrders } from '@/api/hooks/account';
import { OrderCard } from '@/components/site/OrderCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrdersPage() {
  const { data: orders, isLoading, error, refetch } = useMyOrders();

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (error || !orders) {
    return (
      <div className="py-12 text-center">
        <p className="text-ink/70">We couldn&rsquo;t load your orders.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => void refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
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
  }

  return (
    <div>
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
