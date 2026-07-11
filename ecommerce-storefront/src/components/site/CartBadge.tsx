'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/cart/useCart';

export function CartBadge() {
  const { count, hydrated } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={hydrated && count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart'}
      className="relative inline-flex items-center justify-center p-1.5 text-ink hover:text-brand"
    >
      <ShoppingBag aria-hidden className="size-5" />
      {hydrated && count > 0 && (
        <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-brand font-mono text-[10px] text-surface">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
