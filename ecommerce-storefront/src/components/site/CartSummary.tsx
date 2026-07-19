'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { couponsControllerValidate } from '@/api/generated';
import { ApiError, unwrap } from '@/api/unwrap';
import { useAuth } from '@/auth/AuthProvider';
import { subtotalCents, type CartLine } from '@/cart/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckoutButton } from './CheckoutButton';
import { Price } from './Price';

interface CouponQuote {
  code: string;
  discountCents: number;
}

export function CartSummary({ lines }: { lines: CartLine[] }) {
  const subtotal = subtotalCents(lines);
  const { user } = useAuth();
  const router = useRouter();
  const [codeInput, setCodeInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [quote, setQuote] = useState<CouponQuote | null>(null);

  // Re-quote when the subtotal changes so the discount tracks quantity edits;
  // drop the coupon if it stops validating (deactivated, redeemed elsewhere).
  useEffect(() => {
    if (!quote) return;
    let cancelled = false;
    unwrap(
      couponsControllerValidate({
        body: { code: quote.code, subtotalCents: subtotal },
      }),
    )
      .then((q) => {
        if (!cancelled) setQuote({ code: q.code, discountCents: q.discountCents });
      })
      .catch(() => {
        if (!cancelled) {
          setQuote(null);
          toast.error('Coupon removed — it is no longer valid.');
        }
      });
    return () => {
      cancelled = true;
    };
    // Only the subtotal should re-trigger the quote refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  async function applyCoupon() {
    if (!user) {
      router.push('/login?next=/cart');
      return;
    }
    const code = codeInput.trim();
    if (!code) return;
    setApplying(true);
    try {
      const q = await unwrap(
        couponsControllerValidate({ body: { code, subtotalCents: subtotal } }),
      );
      setQuote({ code: q.code, discountCents: q.discountCents });
      setCodeInput('');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not apply coupon');
    } finally {
      setApplying(false);
    }
  }

  const estimatedTotal = Math.max(0, subtotal - (quote?.discountCents ?? 0));

  return (
    <div className="h-fit border border-ink p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs tracking-wide text-ink/60 uppercase">Subtotal</span>
        <Price cents={subtotal} className="text-lg" />
      </div>

      {quote ? (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="font-mono text-xs tracking-wide text-ink/60 uppercase">
            Coupon {quote.code}{' '}
            <button
              type="button"
              onClick={() => setQuote(null)}
              className="ml-1 text-highlight underline underline-offset-2"
            >
              Remove
            </button>
          </span>
          <span className="text-ink">
            −<Price cents={quote.discountCents} className="inline" />
          </span>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <Input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void applyCoupon()}
            placeholder="Coupon code"
            aria-label="Coupon code"
            className="h-9 font-mono uppercase"
          />
          <Button
            type="button"
            variant="outline"
            className="h-9"
            disabled={applying || !codeInput.trim()}
            onClick={() => void applyCoupon()}
          >
            Apply
          </Button>
        </div>
      )}

      {quote && (
        <div className="mt-3 flex items-center justify-between border-t border-ink/10 pt-3">
          <span className="font-mono text-xs tracking-wide text-ink/60 uppercase">
            Estimated total
          </span>
          <Price cents={estimatedTotal} className="text-lg" />
        </div>
      )}

      <p className="mt-2 text-sm text-ink/60">
        Shipping and taxes are calculated at checkout. One coupon per order,
        one use per customer.
      </p>
      <div className="mt-6">
        <CheckoutButton lines={lines} couponCode={quote?.code} />
      </div>
    </div>
  );
}
