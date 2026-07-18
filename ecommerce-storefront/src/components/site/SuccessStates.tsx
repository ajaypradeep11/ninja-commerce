'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ordersControllerFindMine, type OrderResponseDto } from '@/api/generated';
import { unwrap } from '@/api/unwrap';
import { useAuth } from '@/auth/AuthProvider';
import { clearCart } from '@/cart/store';
import { normalizeShippingAddress } from '@/lib/shipping-address';
import { Price } from './Price';
import { pollForOrder } from './success-poll';

const INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 60000;

function timeoutMs(): number {
  const raw = process.env.NEXT_PUBLIC_SUCCESS_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink align-[-2px]"
    />
  );
}

function PollingView() {
  return (
    <div className="flex items-center gap-3 py-24 text-ink/70">
      <Spinner />
      <p role="status">Payment received — confirming your order…</p>
    </div>
  );
}

function SignInPrompt({ next }: { next: string }) {
  return (
    <div className="py-24 text-center">
      <p className="text-ink/70">Sign in to see your order.</p>
      <Link
        href={`/login?next=${encodeURIComponent(next)}`}
        className="mt-4 inline-block text-brand underline underline-offset-4 hover:no-underline"
      >
        Sign in to see your order
      </Link>
    </div>
  );
}

function ReassuranceView() {
  return (
    <div className="py-24 text-center">
      <p className="text-ink/70">
        Your payment is confirmed with Stripe; the order is still processing. It will appear in your orders
        shortly.
      </p>
      <Link href="/account/orders" className="mt-4 inline-block text-brand underline underline-offset-4 hover:no-underline">
        View your orders
      </Link>
    </div>
  );
}

function PaidView({ order }: { order: OrderResponseDto }) {
  const address = normalizeShippingAddress(order.shippingAddress);
  const total = order.totalCents ?? order.subtotalCents;

  return (
    <div>
      <div className="selvedge mb-8" />
      <h1 className="font-display text-3xl text-ink sm:text-4xl">Thank you</h1>
      <p className="mt-2 text-ink/70">
        Order <span className="font-mono">{order.id}</span>
      </p>

      <div className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-ink">{item.name}</p>
              <p className="text-sm text-ink/60">Qty {item.quantity}</p>
            </div>
            <Price cents={item.priceCents * item.quantity} />
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs tracking-wide text-ink/60 uppercase">Subtotal</span>
          <Price cents={order.subtotalCents} />
        </div>
        {order.taxCents != null && (
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs tracking-wide text-ink/60 uppercase">Tax</span>
            <Price cents={order.taxCents} />
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs tracking-wide text-ink/60 uppercase">Total</span>
          <Price cents={total} className="text-lg" />
        </div>
      </div>

      {address && (
        <div className="mt-8">
          <h2 className="font-mono text-xs tracking-wide text-ink/60 uppercase">Shipping to</h2>
          <address className="mt-2 not-italic text-ink/80">
            {address.name && <div>{address.name}</div>}
            <div>{address.line1}</div>
            {address.line2 && <div>{address.line2}</div>}
            <div>
              {address.city}
              {address.state ? `, ${address.state}` : ''} {address.postalCode}
            </div>
            <div>{address.country}</div>
          </address>
        </div>
      )}

      <Link
        href="/account/orders"
        className="mt-10 inline-block text-brand underline underline-offset-4 hover:no-underline"
      >
        View your orders
      </Link>
    </div>
  );
}

type ResolvedState =
  | { kind: 'polling' }
  | { kind: 'paid'; order: OrderResponseDto }
  | { kind: 'reassurance' };

export function SuccessStates() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { user, loading } = useAuth();

  const clearedRef = useRef(false);
  const [resolved, setResolved] = useState<ResolvedState>({ kind: 'polling' });

  // Redirect home if there's no session id — nothing to confirm.
  useEffect(() => {
    if (!sessionId) {
      router.replace('/');
    }
  }, [sessionId, router]);

  // Stripe checkout has finished; clear the cart exactly once regardless of
  // sign-in state. Guarded against React StrictMode's double-invoked effect.
  // Gated on sessionId so a stale/bookmarked visit with no session_id (which
  // redirects home) doesn't silently wipe a non-empty cart on the way out.
  useEffect(() => {
    if (!sessionId) return;
    if (clearedRef.current) return;
    clearedRef.current = true;
    clearCart();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || loading || !user) return;
    let cancelled = false;

    pollForOrder(() => unwrap(ordersControllerFindMine()), sessionId, {
      intervalMs: INTERVAL_MS,
      timeoutMs: timeoutMs(),
    })
      .then((result) => {
        if (cancelled) return;
        if (result.state === 'paid' && result.order) {
          setResolved({ kind: 'paid', order: result.order });
        } else {
          setResolved({ kind: 'reassurance' });
        }
      })
      .catch(() => {
        // A transient fetch failure mid-poll shouldn't surface as an error —
        // the payment already succeeded at Stripe, so keep the tone reassuring.
        if (!cancelled) setResolved({ kind: 'reassurance' });
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, loading, user]);

  if (!sessionId) return null;

  if (loading) return <PollingView />;

  if (!user) {
    const next = `${pathname}?${searchParams.toString()}`;
    return <SignInPrompt next={next} />;
  }

  if (resolved.kind === 'polling') return <PollingView />;
  if (resolved.kind === 'paid') return <PaidView order={resolved.order} />;
  return <ReassuranceView />;
}
