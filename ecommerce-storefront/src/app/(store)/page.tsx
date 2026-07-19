import Image from 'next/image';
import Link from 'next/link';
import { brandsControllerFindAll, productsControllerFindAll } from '@/api/generated';
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

// Product-type tiles: static for now (these aren't DB categories yet), linking
// into the shop search. Emoji is the resting face; the name reveals on hover.
const PRODUCT_TYPES = [
  { label: 'Lamps', emoji: '💡', q: 'lamp' },
  { label: 'Lightbox', emoji: '🖼️', q: 'lightbox' },
  { label: 'Clothing', emoji: '👕', q: 'clothing' },
  { label: 'Beanie', emoji: '🧢', q: 'beanie' },
  { label: 'Socks', emoji: '🧦', q: 'socks' },
  { label: 'Keystraps', emoji: '🔑', q: 'keystrap' },
];

export default async function HomePage() {
  const [brands, products] = await Promise.all([
    // Tolerate a missing /brands endpoint (e.g. the storefront rebuilds before
    // the freshly-pushed API version is live) — degrade to no brand marquee
    // instead of failing the whole build, same as the Header does.
    unwrap(brandsControllerFindAll({ ...serverFetchOptions })).catch(() => []),
    unwrap(
      productsControllerFindAll({
        query: { pageSize: 24, sort: 'newest' },
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

      {/* Anime brands: clickable chips drifting right-to-left. Repeated a few
          times per half so the loop stays seamless on wide screens. */}
      {brands.length > 0 && (
        <section className="overflow-hidden py-10">
          <div className="marquee-track marquee-slow">
            {[0, 1].map((half) => (
              <div key={half} aria-hidden={half === 1} className="flex gap-4 pr-4">
                {Array.from({ length: 4 }).flatMap((_, rep) =>
                  brands.map((brand) => (
                    <Link
                      key={`${rep}-${brand.id}`}
                      href={`/products?brand=${brand.slug}`}
                      tabIndex={half === 1 ? -1 : undefined}
                      className="flex h-14 shrink-0 items-center justify-center rounded-xl border border-ink/15 px-8 font-display text-base whitespace-nowrap text-ink transition-colors hover:border-brand hover:text-brand"
                    >
                      {brand.name}
                    </Link>
                  )),
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Six product-type boxes: emoji at rest, name on hover */}
      <section className="container-wide py-10">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {PRODUCT_TYPES.map((type) => (
            <Link
              key={type.label}
              href={`/products?q=${type.q}`}
              aria-label={type.label}
              className="group relative flex aspect-square items-center justify-center rounded-xl bg-subtle transition-colors hover:bg-subtle/70"
            >
              <span
                aria-hidden
                className="text-6xl transition-opacity duration-200 group-hover:opacity-0"
              >
                {type.emoji}
              </span>
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center font-display text-2xl text-ink opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              >
                {type.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* All products: a slow 5-across crawl, same mechanic as the eBay rail */}
      <section className="overflow-hidden py-16">
        <div className="container-wide flex items-baseline justify-between">
          <p className="font-mono text-xs tracking-wide text-ink/60">ALL PRODUCTS</p>
          <Link href="/products" className="text-sm text-brand hover:underline">
            Shop all
          </Link>
        </div>
        <div className="marquee-track marquee-crawl mt-6">
          {[0, 1].map((half) => (
            <div key={half} aria-hidden={half === 1} className="flex gap-4 pr-4">
              {products.items.map((product) => (
                <div
                  key={`${half}-${product.id}`}
                  className="w-[calc((100vw-6rem)/5)] min-w-52 shrink-0 whitespace-normal"
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <EbayReviews />
    </>
  );
}
