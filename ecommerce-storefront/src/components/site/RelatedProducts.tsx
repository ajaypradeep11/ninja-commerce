import type { ProductResponseDto } from '@/api/generated';
import type { Currency } from '@/lib/money';
import { ProductCard } from './ProductCard';

export function RelatedProducts({
  products,
  currency,
}: {
  products: ProductResponseDto[];
  currency: Currency;
}) {
  if (products.length === 0) return null;

  return (
    <section className="py-16">
      <p className="font-mono text-xs tracking-wide text-ink/60">YOU MAY ALSO LIKE</p>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} currency={currency} />
        ))}
      </div>
    </section>
  );
}
