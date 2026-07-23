'use client';

import { useEffect, useRef } from 'react';
import type { ProductResponseDto } from '@/api/generated';
import type { Currency } from '@/lib/money';
import { ProductCard } from './ProductCard';

const DWELL_MS = 5000;

/**
 * Auto-advancing product rail: sits still, then flips one card along so the
 * next product leads the row. Built on native scrolling, so a shopper can
 * also swipe/drag it themselves; the timer simply nudges it along.
 */
export function ProductRail({
  products,
  currency,
}: {
  products: ProductResponseDto[];
  currency: Currency;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const id = setInterval(() => {
      const card = track.firstElementChild as HTMLElement | null;
      if (!card) return;
      // Card width plus the flex gap = one step.
      const gap = parseFloat(getComputedStyle(track).columnGap || '0');
      const step = card.offsetWidth + gap;
      const atEnd =
        track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      track.scrollTo({
        left: atEnd ? 0 : track.scrollLeft + step,
        behavior: 'smooth',
      });
    }, DWELL_MS);

    return () => clearInterval(id);
  }, []);

  return (
    <div
      ref={trackRef}
      className="flex gap-4 overflow-x-auto pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {products.map((product) => (
        <div
          key={product.id}
          className="w-[calc((100vw-6rem)/5)] min-w-52 shrink-0"
        >
          <ProductCard product={product} currency={currency} />
        </div>
      ))}
    </div>
  );
}
