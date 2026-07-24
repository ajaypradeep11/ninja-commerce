import Image from 'next/image';
import Link from 'next/link';
import type { ProductResponseDto } from '@/api/generated';
import { priceFor } from '@/lib/currency';
import type { Currency } from '@/lib/money';
import { Price } from './Price';
import { RatingStars } from './RatingStars';

const IMAGE_SIZES =
  '(max-width: 768px) 50vw, (max-width: 1280px) 25vw, (max-width: 1536px) 20vw, 17vw';

export function ProductCard({
  product,
  currency,
}: {
  product: ProductResponseDto;
  currency: Currency;
}) {
  const { name, slug, images, stockQty, averageRating, reviewCount } = product;
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
            sizes={IMAGE_SIZES}
            className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
          />
        )}
        {/* Second shot stacked on top, revealed on hover. CSS-only so the card
            stays a server component; decorative alt since the image above
            already names the product. Cards without a second image just keep
            showing the first. */}
        {images[1] && (
          <Image
            src={images[1]}
            alt=""
            fill
            sizes={IMAGE_SIZES}
            className="object-cover opacity-0 group-hover:opacity-100 motion-safe:transition-[opacity,transform] motion-safe:duration-300 motion-safe:group-hover:scale-105"
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
        <Price cents={priceFor(product, currency)} currency={currency} className="text-sm text-ink/80" />
        <RatingStars rating={averageRating} count={reviewCount} />
      </div>
    </Link>
  );
}
