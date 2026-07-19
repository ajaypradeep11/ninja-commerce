import type { ProductResponseDto } from '@/api/generated';
import { ProductCard } from './ProductCard';

export function RelatedProducts({ products }: { products: ProductResponseDto[] }) {
  if (products.length === 0) return null;

  return (
    <section className="container-wide py-16">
      <p className="font-mono text-xs tracking-wide text-ink/60">YOU MAY ALSO LIKE</p>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 xl:grid-cols-5">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
