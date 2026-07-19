'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useOrder } from '@/api/hooks/account';
import { ApiError } from '@/api/unwrap';
import { CancelOrderButton } from '@/components/site/CancelOrderButton';
import { OrderStatusBadge } from '@/components/site/OrderStatusBadge';
import { Price } from '@/components/site/Price';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { normalizeShippingAddress } from '@/lib/shipping-address';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function NotFoundNotice() {
  return (
    <div className="py-12 text-center">
      <p className="text-ink/70">We couldn&rsquo;t find that order.</p>
      <Link
        href="/account/orders"
        className="mt-4 inline-block text-brand underline underline-offset-4 hover:no-underline"
      >
        Back to orders
      </Link>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: order, isLoading, error, refetch } = useOrder(params.id);

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (
    error instanceof ApiError &&
    (error.status === 403 || error.status === 404)
  ) {
    return <NotFoundNotice />;
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-ink/70">We couldn&rsquo;t load this order.</p>
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

  if (!order) {
    return <NotFoundNotice />;
  }

  const address = normalizeShippingAddress(order.shippingAddress);
  const total = order.totalCents ?? order.subtotalCents;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-ink">#{order.id.slice(0, 8)}</p>
          <p className="mt-1 text-sm text-ink/60">
            {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CancelOrderButton orderId={order.id} status={order.status} />
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      <div className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
        {order.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-4 py-4"
          >
            <div>
              <p className="text-ink">{item.name}</p>
              <p className="mt-1 text-sm text-ink/60">
                {item.quantity} × <Price cents={item.priceCents} />
              </p>
            </div>
            <Price cents={item.priceCents * item.quantity} />
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs tracking-wide text-ink/60 uppercase">
            Subtotal
          </span>
          <Price cents={order.subtotalCents} />
        </div>
        {order.discountCents != null && order.discountCents > 0 && (
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs tracking-wide text-ink/60 uppercase">
              Coupon {order.couponCode}
            </span>
            <span>
              −<Price cents={order.discountCents} className="inline" />
            </span>
          </div>
        )}
        {order.taxCents != null && (
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs tracking-wide text-ink/60 uppercase">
              Tax
            </span>
            <Price cents={order.taxCents} />
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs tracking-wide text-ink/60 uppercase">
            Total
          </span>
          <Price cents={total} className="text-lg" />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-mono text-xs tracking-wide text-ink/60 uppercase">
          Shipping to
        </h2>
        {address ? (
          <address className="mt-2 not-italic text-ink/80">
            <div>{address.line1}</div>
            {address.line2 && <div>{address.line2}</div>}
            <div>
              {address.city}
              {address.state ? `, ${address.state}` : ''} {address.postalCode}
            </div>
            <div>{address.country}</div>
          </address>
        ) : (
          <p className="mt-2 text-ink/60">Shipping address unavailable</p>
        )}
      </div>
    </div>
  );
}
