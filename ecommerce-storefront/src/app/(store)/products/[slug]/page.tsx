import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import {
  productsControllerFindAll,
  productsControllerFindBySlug,
} from '@/api/generated';
import type { ProductResponseDto } from '@/api/generated';
import { ApiError, unwrap } from '@/api/unwrap';
import { serverFetchOptions } from '@/api/server';
import { AddToCart } from '@/components/site/AddToCart';
import { Gallery } from '@/components/site/Gallery';
import { Price } from '@/components/site/Price';
import { RatingStars } from '@/components/site/RatingStars';
import { RelatedProducts } from '@/components/site/RelatedProducts';
import { Reviews } from '@/components/site/Reviews';
import { StockLine } from '@/components/site/StockLine';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

// `cache()` dedupes calls with the same slug within a single request so
// generateMetadata and the page component don't both hit the API.
const getProduct = cache(async (slug: string): Promise<ProductResponseDto> => {
  try {
    return await unwrap(
      productsControllerFindBySlug({ path: { slug }, ...serverFetchOptions }),
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
});

async function getRelatedProducts(
  product: ProductResponseDto,
): Promise<ProductResponseDto[]> {
  if (!product.category?.slug) return [];
  const related = await unwrap(
    productsControllerFindAll({
      query: { category: product.category.slug, pageSize: 5 },
      ...serverFetchOptions,
    }),
  );
  return related.items.filter((p) => p.id !== product.id).slice(0, 4);
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  return {
    title: product.name,
    description: product.description.slice(0, 160),
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);
  const relatedProducts = await getRelatedProducts(product);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 md:grid-cols-2 md:items-start">
        <Gallery images={product.images} alt={product.name} />

        <div className="md:sticky md:top-8">
          {product.category && (
            <Link
              href={`/products?category=${product.category.slug}`}
              className="font-mono text-xs tracking-wide text-ink/60 uppercase hover:text-brand"
            >
              {product.category.name}
            </Link>
          )}

          <h1 className="mt-2 font-display text-3xl text-ink sm:text-4xl">
            {product.name}
          </h1>

          <Price cents={product.priceCents} className="mt-4 text-2xl" />

          {product.averageRating !== null && (
            <Link
              href="#reviews"
              className="mt-2 inline-block hover:text-brand"
            >
              <RatingStars
                rating={product.averageRating}
                count={product.reviewCount}
              />
            </Link>
          )}

          <div className="mt-4">
            <StockLine stockQty={product.stockQty} />
          </div>

          <p className="mt-6 text-ink/70">{product.description}</p>

          <div className="mt-8">
            <AddToCart product={product} />
          </div>

          <Accordion type="single" collapsible className="mt-10">
            <AccordionItem value="details">
              <AccordionTrigger>Details</AccordionTrigger>
              <AccordionContent>
                <p>{product.description}</p>
                <p className="mt-2">
                  100% GOTS-certified organic cotton. Machine wash cold, hang
                  dry.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="shipping">
              <AccordionTrigger>Shipping &amp; returns</AccordionTrigger>
              <AccordionContent>
                <p>
                  Ships within 48 hours. Free returns for 30 days — see our{' '}
                  <Link
                    href="/shipping-returns"
                    className="underline hover:text-brand"
                  >
                    shipping &amp; returns policy
                  </Link>
                  .
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Reviews productId={product.id} slug={slug} />
        </div>
      </div>

      <RelatedProducts products={relatedProducts} />
    </div>
  );
}
