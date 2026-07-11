'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { ProductResponseDto } from '@/api/generated';
import { addLine } from '@/cart/store';
import { Button } from '@/components/ui/button';
import { QtyStepper } from './QtyStepper';

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
      <QtyStepper value={qty} onChange={setQty} max={max} />
      <Button onClick={handleAdd} size="lg" className="flex-1 bg-ink text-surface hover:bg-ink/90">
        Add to cart
      </Button>
    </div>
  );
}
