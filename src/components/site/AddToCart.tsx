'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductResponseDto } from '@/api/generated';
import { addLine } from '@/cart/store';
import { Button } from '@/components/ui/button';

export function AddToCart({ product }: { product: ProductResponseDto }) {
  const { id, slug, name, priceCents, images, stockQty } = product;
  const [qty, setQty] = useState(1);

  if (stockQty === 0) {
    return (
      <Button disabled size="lg" className="w-full">
        <span className="font-mono">OUT OF STOCK</span>
      </Button>
    );
  }

  const max = Math.min(stockQty, 99);

  function handleAdd() {
    addLine({ productId: id, slug, name, priceCents, image: images[0] ?? null, stockQty }, qty);
    toast.success('Added to cart');
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center border border-ink">
        <button
          type="button"
          aria-label="Decrease quantity"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="p-2 text-ink hover:text-indigo disabled:opacity-40"
          disabled={qty <= 1}
        >
          <Minus aria-hidden className="size-4" />
        </button>
        <span className="w-8 text-center font-mono">{qty}</span>
        <button
          type="button"
          aria-label="Increase quantity"
          onClick={() => setQty((q) => Math.min(max, q + 1))}
          className="p-2 text-ink hover:text-indigo disabled:opacity-40"
          disabled={qty >= max}
        >
          <Plus aria-hidden className="size-4" />
        </button>
      </div>
      <Button onClick={handleAdd} size="lg" className="flex-1 bg-ink text-cotton hover:bg-ink/90">
        Add to cart
      </Button>
    </div>
  );
}
