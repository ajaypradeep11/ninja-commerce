import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';
import {
  brandsControllerFindAll,
  categoriesControllerFindAll,
  productsControllerFindAll,
} from '@/api/generated';
import { unwrap } from '@/api/unwrap';
import { serverFetchOptions } from '@/api/server';
import { CURRENCY_COOKIE, parseCurrency } from '@/lib/currency';
import { SITE } from '@/lib/site';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/site/ProductCard';
import { ProductRail } from '@/components/site/ProductRail';
import { EbayReviews } from '@/components/site/EbayReviews';
import { HeroCarousel } from '@/components/site/HeroCarousel';

// Hero shots, cross-faded in order (both 3200x1344, ~0.8MB JPEG).
const HERO_SLIDES = [
  // The Naruto LED lamp lineup. Boxes sit mid-frame across the full width, so
  // a plain centre crop keeps the row intact.
  { src: '/hero-naruto-lamps.jpg', className: 'object-center' },
  // The lamp lineup glowing on marble, framed slightly high and pushed down on
  // phones so the lamps clear the overlaid copy.
  {
    src: '/hero.jpg',
    className:
      'object-[center_45%] max-sm:translate-y-6 max-sm:scale-110 max-sm:object-[center_0%]',
  },
];

// The hero's primary CTA already points here, so this category is left out of
// the tile grid below rather than shown twice. Both read the same constant so
// they can't drift apart.
const HERO_CATEGORY_SLUG = 'anime-lamps';

// Category tiles are parked until their artwork is uploaded in admin — without
// it the row is a wall of blank boxes. Flip to true to bring the grid back;
// the markup below is otherwise untouched.
const SHOW_CATEGORY_TILES = false;

// Tailwind needs whole class names at build time, so the column count can't be
// interpolated. Six is the widest the tiles read well at; beyond that they wrap.
const XL_COLUMNS: Record<number, string> = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
  6: 'xl:grid-cols-6',
};

export default async function HomePage() {
  // Reading cookies opts this route into dynamic rendering, which is what stops
  // a cached page from serving the wrong currency's prices.
  const currency = parseCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);

  const [brands, categories, products] = await Promise.all([
    // Tolerate a missing /brands endpoint (e.g. the storefront rebuilds before
    // the freshly-pushed API version is live) — degrade to no brand marquee
    // instead of failing the whole build, same as the Header does.
    unwrap(brandsControllerFindAll({ ...serverFetchOptions })).catch(() => []),
    unwrap(categoriesControllerFindAll({ ...serverFetchOptions })).catch(
      () => [],
    ),
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
  const LOGO_REPEATS = Math.max(
    2,
    Math.ceil(10 / Math.max(1, logoBrands.length)),
  );

  // The hero already leads with one category, so the grid covers the rest.
  const tileCategories = categories.filter(
    (category) => category.slug !== HERO_CATEGORY_SLUG,
  );

  return (
    <>
      {/* Allbirds-style hero: full-bleed image, eyebrow + headline + CTAs
          overlaid near the bottom. Swap HERO_IMAGE for a shot art-directed
          for this space when one exists. */}
      {/* Cancels the layout's notch clearance so the pill floats over the
          hero image, Allbirds-style. */}
      <section className="-mt-[var(--notch-space)] px-3 pt-3">
        <div className="relative h-[78vh] min-h-105 overflow-hidden rounded-2xl sm:h-[88vh]">
          <HeroCarousel slides={HERO_SLIDES} />
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
                  <Link href={`/products?category=${HERO_CATEGORY_SLUG}`}>
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
      {/* Category boxes, straight from the DB: tile artwork uploaded in admin
          at rest, name on hover. Categories without artwork show their name
          outright, so the row still works before the images land. Same 12px
          edge inset as the floating notch bar so the two align. */}
      {SHOW_CATEGORY_TILES && tileCategories.length > 0 && (
        <section className="px-3 pt-0 pb-10">
          <div
            className={`grid grid-cols-2 gap-4 sm:grid-cols-3 ${
              XL_COLUMNS[Math.min(tileCategories.length, 6)] ?? 'xl:grid-cols-6'
            }`}
          >
            {tileCategories.map((category) => (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                aria-label={category.name}
                className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-subtle transition-colors hover:bg-subtle/70"
              >
                {category.imageUrl && (
                  <Image
                    src={category.imageUrl}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 17vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
                {/* Scrim only where there's art to sit on, so the name stays
                    legible over a bright photo. */}
                <span
                  aria-hidden
                  className={
                    category.imageUrl
                      ? 'absolute inset-0 flex items-center justify-center bg-black/45 font-display text-2xl text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100'
                      : 'absolute inset-0 flex items-center justify-center px-3 text-center font-display text-2xl text-ink'
                  }
                >
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Logo rail: only brands that actually have artwork appear here — a
          name-only chip among logos looks unfinished. Every brand is still
          reachable from the menu's Anime group and the shop filters. */}
      {logoBrands.length > 0 && (
        <>
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
                        className="flex h-40 shrink-0 items-center justify-center px-8 transition-transform hover:scale-105"
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
          {/* Closes the brand rail off from the product crawl below. Rides with
            the rail so it doesn't strand a divider when no brands have art.
            Tight top margin pulls it up close under the logos. */}
          <div className="selvedge mt-2 mb-6" />
        </>
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
        <div className="mt-6">
          <ProductRail products={products.items} currency={currency} />
        </div>
      </section>

      <EbayReviews />
    </>
  );
}
