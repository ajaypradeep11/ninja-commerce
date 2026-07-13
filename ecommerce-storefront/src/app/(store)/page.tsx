import Image from 'next/image';
import Link from 'next/link';
import { categoriesControllerFindAll, productsControllerFindAll } from '@/api/generated';
import { unwrap } from '@/api/unwrap';
import { serverFetchOptions } from '@/api/server';
import { SITE } from '@/lib/site';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/site/ProductCard';

const COLLAGE_POSITION = [
  'top-0 left-2 sm:left-4',
  'top-10 left-1/2 -translate-x-1/2',
  'top-20 right-2 sm:right-4',
];

export default async function HomePage() {
  const [categories, products] = await Promise.all([
    unwrap(categoriesControllerFindAll({ ...serverFetchOptions })),
    unwrap(
      productsControllerFindAll({
        query: { pageSize: 8, sort: 'newest' },
        ...serverFetchOptions,
      }),
    ),
  ]);

  const collage = products.items.slice(0, 3);

  return (
    <>
      <section className="bg-subtle">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
              Your favorite anime, in a whole new light.
            </h1>
            <p className="mt-5 max-w-md text-ink/70">{SITE.tagline}</p>
            <Button asChild size="lg" className="mt-8 bg-brand text-surface hover:bg-brand/90">
              <Link href="/products">Shop anime lamps</Link>
            </Button>
          </div>
          <div className="relative h-72 sm:h-96">
            {collage.map(
              (product, i) =>
                product.images[0] && (
                  <div
                    key={product.id}
                    className={cn(
                      'absolute aspect-3/4 w-36 overflow-hidden border border-surface sm:w-48',
                      COLLAGE_POSITION[i],
                    )}
                    style={{ zIndex: i }}
                  >
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 144px, 192px"
                      className="object-cover"
                    />
                  </div>
                ),
            )}
          </div>
        </div>
      </section>
      <div className="selvedge" />

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/products?category=${category.slug}`}
              className="flex aspect-square items-center justify-center bg-subtle p-4 text-center font-display text-lg text-ink transition-colors hover:bg-subtle/70"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="font-mono text-xs tracking-wide text-ink/60">NEW ARRIVALS</p>
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {products.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </>
  );
}
