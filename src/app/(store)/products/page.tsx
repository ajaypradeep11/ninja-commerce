import Link from 'next/link';
import { notFound } from 'next/navigation';
import { categoriesControllerFindAll, productsControllerFindAll } from '@/api/generated';
import { unwrap } from '@/api/unwrap';
import { serverFetchOptions } from '@/api/server';
import { ProductCard } from '@/components/site/ProductCard';
import { ListingControls } from '@/components/site/ListingControls';
import { Pagination } from '@/components/site/Pagination';

export const metadata = { title: 'Shop' };

const SORT_VALUES = ['newest', 'price_asc', 'price_desc'] as const;
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
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const categorySlug = first(params.category);
  const q = first(params.q);
  const sort = parseSort(params.sort);
  const page = parsePage(params.page);

  const [categories, products] = await Promise.all([
    unwrap(categoriesControllerFindAll({ ...serverFetchOptions })),
    unwrap(
      productsControllerFindAll({
        query: { category: categorySlug, q, sort, page },
        ...serverFetchOptions,
      }),
    ),
  ]);

  const activeCategory = categorySlug
    ? categories.find((category) => category.slug === categorySlug)
    : undefined;

  if (categorySlug && !activeCategory) {
    notFound();
  }

  const heading = activeCategory ? activeCategory.name : q ? `Results for "${q}"` : 'Shop all';

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">{heading}</h1>
        <p className="font-mono text-xs tracking-wide text-ink/60">{products.total} PRODUCTS</p>
      </div>

      <div className="mt-8">
        <ListingControls
          categories={categories}
          activeCategory={activeCategory?.slug}
          sort={sort}
          q={q}
        />
      </div>

      {products.items.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-ink/70">
            No products match. Try clearing the search or picking another category.
          </p>
          <Link href="/products" className="mt-4 inline-block text-indigo hover:underline">
            Clear filters
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
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
  );
}
