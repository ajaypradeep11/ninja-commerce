'use client';

import Link from 'next/link';
import { useMyOrders } from '@/api/hooks/account';
import { OrderCard } from '@/components/site/OrderCard';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrdersPage() {
  const { data: orders, isLoading } = useMyOrders();

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-ink/70">No orders yet.</p>
        <Link
          href="/products"
          className="mt-4 inline-block text-indigo underline underline-offset-4 hover:no-underline"
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
