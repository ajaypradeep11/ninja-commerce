import Image from 'next/image';
import Link from 'next/link';
import {
  brandsControllerFindAll,
  productsControllerFindAll,
} from '@/api/generated';
import { unwrap } from '@/api/unwrap';
import { serverFetchOptions } from '@/api/server';
import { SITE } from '@/lib/site';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/site/ProductCard';
import { EbayReviews } from '@/components/site/EbayReviews';

// Hero shot: the lamp lineup glowing on marble (3200x1344, ~0.8MB JPEG).
const HERO_IMAGE = '/hero.jpg';

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

  // Only logo'd brands ride the marquee; repeat them enough to fill an
  // ultrawide viewport so the -50% loop stays seamless.
  const logoBrands = brands.filter((brand) => brand.logoUrl);
  const LOGO_REPEATS = Math.max(2, Math.ceil(10 / Math.max(1, logoBrands.length)));

  return (
    <>
      {/* Allbirds-style hero: full-bleed image, eyebrow + headline + CTAs
          overlaid near the bottom. Swap HERO_IMAGE for a shot art-directed
          for this space when one exists. */}
      <section className="px-3 pt-3">
        <div className="relative h-[78vh] min-h-105 overflow-hidden rounded-2xl sm:h-[88vh]">
          <Image
            src={HERO_IMAGE}
            alt=""
            fill
            priority
            sizes="100vw"
            className="rounded-2xl object-cover object-[center_45%] max-sm:translate-y-6 max-sm:scale-110 max-sm:object-[center_0%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
          {/* Ottawa delivery note bottom-left; copy bottom-right, Allbirds style */}
          <div className="container-wide absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-6 pb-10 sm:pb-14">
            <aside
              className="max-w-xs text-white"
              aria-label="Shipping and delivery"
            >
              <p className="font-display text-base leading-tight whitespace-nowrap sm:text-xl">
                📍 OTTAWA · FREE SHIPPING
              </p>
            </aside>

            <div className="flex flex-col items-end text-right">
              <p className="font-mono text-xs tracking-widest text-white/80">
                COLLECTIBLE LED LAMPS
              </p>
              <h1 className="mt-2 max-w-3xl font-display text-4xl leading-tight text-white sm:text-6xl">
                Your favorite anime, in a whole new light.
              </h1>
              <p className="mt-3 max-w-md text-white/80">{SITE.tagline}</p>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button
                  asChild
                  size="lg"
                  className="bg-brand text-black hover:bg-brand/90"
                >
                  <Link href="/products?category=anime-lamps">
                    Shop anime lamps
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  className="bg-white text-black hover:bg-white/90"
                >
                  <Link href="/products">Shop all</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="selvedge my-6" />

      {/* Anime brands: clickable chips drifting right-to-left. Repeated a few
          times per half so the loop stays seamless on wide screens. */}
      {/* Six product-type boxes: emoji at rest, name on hover. Same 12px
          edge inset as the floating notch bar so the two align. */}
      <section className="px-3 pt-0 pb-10">
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

      {/* Logo rail: only brands that actually have artwork appear here — a
          name-only chip among logos looks unfinished. Every brand is still
          reachable from the menu's Anime group and the shop filters. */}
      {logoBrands.length > 0 && (
        <section className="-mt-6 overflow-hidden pt-0 pb-6">
          <div className="marquee-track marquee-slow">
            {[0, 1].map((half) => (
              <div
                key={half}
                aria-hidden={half === 1}
                className="flex gap-4 pr-4"
              >
                {Array.from({ length: LOGO_REPEATS }).flatMap((_, rep) =>
                  logoBrands.map((brand) => (
                    <Link
                      key={`${rep}-${brand.id}`}
                      href={`/products?brand=${brand.slug}`}
                      tabIndex={half === 1 ? -1 : undefined}
                      className="flex h-40 shrink-0 items-center justify-center px-8 opacity-85 transition-opacity hover:opacity-100"
                    >
                      {/* Square and wide logos both get room: height caps the
                          tall ones, max-width caps the banner-shaped ones. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={brand.logoUrl!}
                        alt={brand.name}
                        className="max-h-40 w-auto max-w-96 object-contain"
                      />
                    </Link>
                  )),
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All products: a slow 5-across crawl, same mechanic as the eBay rail */}
      <section className="overflow-hidden py-16">
        <div className="container-wide flex items-baseline justify-between">
          <p className="font-mono text-xs tracking-wide text-ink/60">
            ALL PRODUCTS
          </p>
          <Link href="/products" className="text-sm text-brand hover:underline">
            Shop all
          </Link>
        </div>
        <div className="marquee-track marquee-crawl mt-6">
          {[0, 1].map((half) => (
            <div
              key={half}
              aria-hidden={half === 1}
              className="flex gap-4 pr-4"
            >
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
