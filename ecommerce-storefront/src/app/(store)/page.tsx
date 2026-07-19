import Image from 'next/image';
import Link from 'next/link';
import {
  brandsControllerFindAll,
  categoriesControllerFindAll,
  productsControllerFindAll,
} from '@/api/generated';
import { unwrap } from '@/api/unwrap';
import { serverFetchOptions } from '@/api/server';
import { SITE } from '@/lib/site';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/site/ProductCard';
import { EbayReviews } from '@/components/site/EbayReviews';

const COLLAGE_POSITION = [
  'top-0 left-2 sm:left-4',
  'top-10 left-1/2 -translate-x-1/2',
  'top-20 right-2 sm:right-4',
];

export default async function HomePage() {
  const [categories, brands, products] = await Promise.all([
    unwrap(categoriesControllerFindAll({ ...serverFetchOptions })),
    // Tolerate a missing /brands endpoint (e.g. the storefront rebuilds before
    // the freshly-pushed API version is live) — degrade to no brand chips
    // instead of failing the whole build, same as the Header does.
    unwrap(brandsControllerFindAll({ ...serverFetchOptions })).catch(() => []),
    unwrap(
      productsControllerFindAll({
        query: { pageSize: 8, sort: 'newest' },
        ...serverFetchOptions,
      }),
    ),
  ]);

  // Only products that actually have an image can appear in the hero collage;
  // otherwise the collage column renders as a large empty block.
  const collage = products.items.filter((p) => p.images[0]).slice(0, 3);

  return (
    <>
      <section className="bg-subtle">
        <div className="container-wide grid max-w-[150rem] gap-12 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
              Your favorite anime, in a whole new light.
            </h1>
            <p className="mt-5 max-w-md text-ink/70">{SITE.tagline}</p>
            <Button asChild size="lg" className="mt-8 bg-brand text-surface hover:bg-brand/90">
              <Link href="/products">Shop anime lamps</Link>
            </Button>
          </div>
          {collage.length > 0 && (
          <div className="relative h-72 sm:h-96 lg:h-[30rem]">
            {collage.map(
              (product, i) =>
                product.images[0] && (
                  <div
                    key={product.id}
                    className={cn(
                      'absolute aspect-3/4 w-36 overflow-hidden rounded-xl border border-surface shadow-lg sm:w-48 lg:w-60',
                      COLLAGE_POSITION[i],
                    )}
                    style={{ zIndex: i }}
                  >
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 144px, (max-width: 1024px) 192px, 240px"
                      className="object-cover"
                    />
                  </div>
                ),
            )}
          </div>
          )}
        </div>
      </section>
      <div className="selvedge" />

      {/* Short Casetify-style category chips — a slim strip, not tall tiles */}
      <section className="container-wide py-16">
        <div className="flex flex-wrap gap-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/products?category=${category.slug}`}
              className="flex h-20 min-w-56 items-center justify-center rounded-xl bg-subtle px-8 text-center font-display text-lg text-ink transition-colors hover:bg-subtle/70"
            >
              {category.name}
            </Link>
          ))}
        </div>

        {brands.length > 0 && (
          <>
            <p className="mt-10 font-mono text-xs tracking-wide text-ink/60">ANIME</p>
            <div className="mt-4 flex flex-wrap gap-4">
              {brands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/products?brand=${brand.slug}`}
                  className="flex h-14 min-w-44 items-center justify-center rounded-xl border border-ink/15 px-6 text-center font-display text-base text-ink transition-colors hover:border-brand hover:text-brand"
                >
                  {brand.name}
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      {/* White "island": scope a light theme so the products section reads as
          dark-on-white against the dark site theme. */}
      <section data-theme="atelier" className="bg-surface text-ink">
        <div className="container-wide py-16">
          <p className="font-mono text-xs tracking-wide text-ink/60">
            NEW ARRIVALS
          </p>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {products.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <EbayReviews />
    </>
  );
}
