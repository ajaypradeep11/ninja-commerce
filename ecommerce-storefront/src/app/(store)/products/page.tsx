import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  brandsControllerFindAll,
  categoriesControllerFindAll,
  productsControllerFindAll,
} from '@/api/generated';
import { unwrap } from '@/api/unwrap';
import { serverFetchOptions } from '@/api/server';
import { ProductCard } from '@/components/site/ProductCard';
import { FilterSortPanel } from '@/components/site/FilterSortPanel';
import { Pagination } from '@/components/site/Pagination';

export const metadata = { title: 'Shop' };

const SORT_VALUES = [
  'newest',
  'best_selling',
  'price_asc',
  'price_desc',
] as const;
type Sort = (typeof SORT_VALUES)[number];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseSort(value: string | string[] | undefined): Sort {
  const raw = first(value);
  return (SORT_VALUES as readonly string[]).includes(raw ?? '') ? (raw as Sort) : 'newest';
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Number(first(value));
  const parsed = Math.floor(raw);
  return !Number.isFinite(parsed) || parsed < 1 ? 1 : parsed;
}

// The filter panel ticks several boxes at once, so category/brand arrive as
// comma-separated slug lists.
function parseSlugs(value: string | string[] | undefined): string[] {
  return (first(value) ?? '')
    .split(',')
    .map((slug) => slug.trim())
    .filter(Boolean);
}

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const categorySlugs = parseSlugs(params.category);
  const brandSlugs = parseSlugs(params.brand);
  const q = first(params.q);
  const sort = parseSort(params.sort);
  const page = parsePage(params.page);

  const [categories, brands, products] = await Promise.all([
    unwrap(categoriesControllerFindAll({ ...serverFetchOptions })),
    // Degrade to no brand filters if /brands is unavailable (matches Header).
    unwrap(brandsControllerFindAll({ ...serverFetchOptions })).catch(() => []),
    unwrap(
      productsControllerFindAll({
        query: {
          category: categorySlugs.join(',') || undefined,
          brand: brandSlugs.join(',') || undefined,
          q,
          sort,
          page,
        },
        ...serverFetchOptions,
      }),
    ),
  ]);

  const activeCategories = categories.filter((c) =>
    categorySlugs.includes(c.slug),
  );
  const activeBrands = brands.filter((b) => brandSlugs.includes(b.slug));

  // A slug that matches nothing is a bad URL, not an empty result set.
  if (
    activeCategories.length !== categorySlugs.length ||
    activeBrands.length !== brandSlugs.length
  ) {
    notFound();
  }

  const heading =
    activeCategories.length === 1 && !activeBrands.length
      ? activeCategories[0].name
      : activeBrands.length === 1 && !activeCategories.length
        ? activeBrands[0].name
        : q
          ? `Results for "${q}"`
          : 'Shop all';

  return (
    <>
      <div className="container-wide pt-12 pb-10">
        <div className="space-y-2">
          <h1 className="font-display text-3xl text-ink sm:text-4xl">{heading}</h1>
          <p className="font-mono text-xs tracking-wide text-ink/60">{products.total} PRODUCTS</p>
        </div>

        <div className="mt-8">
          <FilterSortPanel
            categories={categories}
            brands={brands}
            activeCategories={activeCategories.map((c) => c.slug)}
            activeBrands={activeBrands.map((b) => b.slug)}
            sort={sort}
            q={q}
          />
        </div>
      </div>

      {/* White "island": scope a light theme so the product grid reads as
          dark-on-white against the dark site theme (matches the home page). */}
      <section data-theme="atelier" className="bg-surface text-ink">
        <div className="container-wide py-12">
          {products.items.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-ink/70">
                No products match. Try clearing the search or picking another category.
              </p>
              <Link href="/products" className="mt-4 inline-block text-brand hover:underline">
                Clear filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {products.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          <Pagination
            page={products.page}
            total={products.total}
            pageSize={products.pageSize}
            basePath="/products"
            searchParams={params}
          />
        </div>
      </section>
    </>
  );
}
