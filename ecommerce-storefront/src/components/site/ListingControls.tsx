'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { BrandResponseDto, CategoryResponseDto } from '@/api/generated';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
] as const;

type Sort = (typeof SORT_OPTIONS)[number]['value'];

interface ListingControlsProps {
  categories: CategoryResponseDto[];
  brands: BrandResponseDto[];
  activeCategory?: string;
  activeBrand?: string;
  sort: Sort;
  q?: string;
}

function pillClass(active: boolean): string {
  return cn(
    'border border-ink px-3 py-1 font-mono text-xs tracking-wide transition-colors',
    active ? 'bg-ink text-surface' : 'bg-surface text-ink hover:bg-ink/5',
  );
}

export function ListingControls({
  categories,
  brands,
  activeCategory,
  activeBrand,
  sort,
  q,
}: ListingControlsProps) {
  const router = useRouter();

  function href(params: { category?: string; brand?: string }): string {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (params.category) qs.set('category', params.category);
    if (params.brand) qs.set('brand', params.brand);
    const query = qs.toString();
    return query ? `/products?${query}` : '/products';
  }

  function handleSortChange(value: string) {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (activeCategory) qs.set('category', activeCategory);
    if (activeBrand) qs.set('brand', activeBrand);
    if (value !== 'newest') qs.set('sort', value);
    const query = qs.toString();
    router.push(query ? `/products?${query}` : '/products');
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Link href={href({ brand: activeBrand })} className={pillClass(!activeCategory)}>
            All
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={href({ category: category.slug, brand: activeBrand })}
              className={pillClass(activeCategory === category.slug)}
            >
              {category.name}
            </Link>
          ))}
        </div>

        {brands.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs tracking-wide text-ink/60">ANIME</span>
            <Link
              href={href({ category: activeCategory })}
              className={pillClass(!activeBrand)}
            >
              All
            </Link>
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={href({ category: activeCategory, brand: brand.slug })}
                className={pillClass(activeBrand === brand.slug)}
              >
                {brand.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <Select value={sort} onValueChange={handleSortChange}>
        <SelectTrigger aria-label="Sort by" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
