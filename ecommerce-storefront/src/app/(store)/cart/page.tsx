'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { getLines, removeLine, setQuantity } from '@/cart/store';
import { useCart } from '@/cart/useCart';
import { applyCartRefresh } from '@/components/site/cart-refresh';
import { CartLineRow } from '@/components/site/CartLineRow';
import { CartSummary } from '@/components/site/CartSummary';

export default function CartPage() {
  const { lines, hydrated } = useCart();

  useEffect(() => {
    applyCartRefresh(getLines())
      .then(({ removedUnavailable }) => {
        if (removedUnavailable) {
          toast.error('Some items are no longer available and were removed.');
        }
      })
      .catch(() => {
        /* best-effort refresh — leave the cart as-is on unexpected failure */
      });
  }, []);

  if (!hydrated) {
    return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" />;
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="text-ink/70">Your cart is empty.</p>
        <Link href="/products" className="mt-4 inline-block text-indigo hover:underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl text-ink sm:text-4xl">Cart</h1>
      <div className="selvedge my-6" />

      <div className="grid gap-10 md:grid-cols-[1fr_320px]">
        <div>
          {lines.map((line) => (
            <CartLineRow key={line.productId} line={line} onQuantityChange={setQuantity} onRemove={removeLine} />
          ))}
        </div>

        <CartSummary lines={lines} />
      </div>
    </div>
  );
}
