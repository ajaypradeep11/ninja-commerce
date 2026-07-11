'use client';

import Image from 'next/image';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { CartLine } from '@/cart/store';
import { cn } from '@/lib/utils';
import { Price } from './Price';
import { QtyStepper } from './QtyStepper';

export function CartLineRow({
  line,
  onQuantityChange,
  onRemove,
}: {
  line: CartLine;
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}) {
  const outOfStock = line.stockQty === 0;
  const lowStock = !outOfStock && line.quantity === line.stockQty && line.stockQty >= 1 && line.stockQty <= 5;
  const max = Math.min(line.stockQty, 99);

  return (
    <div className="flex gap-4 border-b border-ink/10 py-6 first:pt-0">
      <Link
        href={`/products/${line.slug}`}
        className={cn('relative block h-24 w-20 shrink-0 overflow-hidden bg-subtle', outOfStock && 'opacity-40')}
      >
        {line.image && (
          <Image src={line.image} alt={line.name} fill sizes="80px" className="object-cover" />
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href={`/products/${line.slug}`} className="text-ink hover:text-brand">
            {line.name}
          </Link>
          <div className="mt-1">
            <Price cents={line.priceCents} className="text-sm text-ink/60" />
          </div>
          {outOfStock && <p className="mt-1 font-mono text-sm text-highlight">Out of stock</p>}
          {lowStock && <p className="mt-1 font-mono text-sm text-highlight">Only {line.stockQty} left</p>}
        </div>

        <div className="flex items-center gap-4">
          <QtyStepper
            value={line.quantity}
            max={max}
            disabled={outOfStock}
            onChange={(q) => onQuantityChange(line.productId, q)}
          />
          <Price cents={line.priceCents * line.quantity} className="w-20 text-right" />
          <button
            type="button"
            aria-label={`Remove ${line.name}`}
            onClick={() => onRemove(line.productId)}
            className="p-1.5 text-ink/60 hover:text-highlight"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
