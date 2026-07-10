'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CategoryResponseDto } from '@/api/generated';
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
  activeCategory?: string;
  sort: Sort;
  q?: string;
}

export function ListingControls({ categories, activeCategory, sort, q }: ListingControlsProps) {
  const router = useRouter();

  function pillHref(slug?: string): string {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (slug) qs.set('category', slug);
    const query = qs.toString();
    return query ? `/products?${query}` : '/products';
  }

  function handleSortChange(value: string) {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (activeCategory) qs.set('category', activeCategory);
    if (value !== 'newest') qs.set('sort', value);
    const query = qs.toString();
    router.push(query ? `/products?${query}` : '/products');
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap gap-2">
        <Link
          href={pillHref()}
          className={cn(
            'border border-ink px-3 py-1 font-mono text-xs tracking-wide transition-colors',
            !activeCategory ? 'bg-ink text-cotton' : 'bg-cotton text-ink hover:bg-ink/5',
          )}
        >
          All
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={pillHref(category.slug)}
            className={cn(
              'border border-ink px-3 py-1 font-mono text-xs tracking-wide transition-colors',
              activeCategory === category.slug
                ? 'bg-ink text-cotton'
                : 'bg-cotton text-ink hover:bg-ink/5',
            )}
          >
            {category.name}
          </Link>
        ))}
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
