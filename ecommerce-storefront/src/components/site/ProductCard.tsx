import Image from 'next/image';
import Link from 'next/link';
import type { ProductResponseDto } from '@/api/generated';
import { Price } from './Price';
import { RatingStars } from './RatingStars';

export function ProductCard({ product }: { product: ProductResponseDto }) {
  const { name, slug, images, priceCents, stockQty, averageRating, reviewCount } = product;
  const outOfStock = stockQty === 0;
  const lowStock = stockQty >= 1 && stockQty <= 5;

  return (
    <Link
      href={`/products/${slug}`}
      className="group block motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-1"
    >
      <div className="relative aspect-3/4 overflow-hidden rounded-xl bg-subtle motion-safe:transition-shadow motion-safe:duration-200 motion-safe:group-hover:shadow-md">
        {images[0] && (
          <Image
            src={images[0]}
            alt={name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
          />
        )}
        {outOfStock && (
          <span className="absolute top-2 left-2 rounded-full bg-surface/90 px-2.5 py-1 font-mono text-[10px] tracking-wide text-ink backdrop-blur-sm">
            OUT OF STOCK
          </span>
        )}
        {lowStock && (
          <span className="absolute top-2 left-2 rounded-full bg-highlight px-2.5 py-1 font-mono text-[10px] tracking-wide text-surface">
            LOW STOCK
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="text-sm font-medium text-ink">{name}</h3>
        <Price cents={priceCents} className="text-sm text-ink/80" />
        <RatingStars rating={averageRating} count={reviewCount} />
      </div>
    </Link>
  );
}
