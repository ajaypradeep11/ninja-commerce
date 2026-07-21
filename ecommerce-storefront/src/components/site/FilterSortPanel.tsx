'use client';

import { ChevronDown, ChevronUp, SlidersHorizontal, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BrandResponseDto, CategoryResponseDto } from '@/api/generated';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'best_selling', label: 'Best selling' },
  { value: 'price_asc', label: 'Price, low to high' },
  { value: 'price_desc', label: 'Price, high to low' },
] as const;

export type Sort = (typeof SORT_OPTIONS)[number]['value'];

interface FilterSortPanelProps {
  categories: CategoryResponseDto[];
  brands: BrandResponseDto[];
  activeCategories: string[];
  activeBrands: string[];
  sort: Sort;
  q?: string;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-t border-ink/10 py-5 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between font-mono text-xs tracking-widest text-ink uppercase"
      >
        {title}
        {open ? (
          <ChevronUp aria-hidden className="size-4" />
        ) : (
          <ChevronDown aria-hidden className="size-4" />
        )}
      </button>
      {open && <div className="mt-4 space-y-3">{children}</div>}
    </div>
  );
}

export function FilterSortPanel({
  categories,
  brands,
  activeCategories,
  activeBrands,
  sort,
  q,
}: FilterSortPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Draft state so nothing navigates until "Apply".
  const [draftSort, setDraftSort] = useState<Sort>(sort);
  const [draftCategories, setDraftCategories] = useState(activeCategories);
  const [draftBrands, setDraftBrands] = useState(activeBrands);

  const activeCount = activeCategories.length + activeBrands.length;

  function toggle(list: string[], slug: string): string[] {
    return list.includes(slug)
      ? list.filter((s) => s !== slug)
      : [...list, slug];
  }

  function apply() {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (draftCategories.length) qs.set('category', draftCategories.join(','));
    if (draftBrands.length) qs.set('brand', draftBrands.join(','));
    if (draftSort !== 'newest') qs.set('sort', draftSort);
    const query = qs.toString();
    setOpen(false);
    router.push(query ? `/products?${query}` : '/products');
  }

  function clearAll() {
    setDraftSort('newest');
    setDraftCategories([]);
    setDraftBrands([]);
  }

  function openPanel() {
    // Re-sync the draft with whatever the URL currently reflects.
    setDraftSort(sort);
    setDraftCategories(activeCategories);
    setDraftBrands(activeBrands);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-ink/25 px-6 py-3 font-mono text-sm tracking-widest text-ink uppercase transition-colors hover:border-ink"
      >
        <SlidersHorizontal aria-hidden className="size-4" />
        Filter and Sort
        {activeCount > 0 && (
          <span className="rounded-full bg-ink px-2 py-0.5 text-xs text-surface">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-60 flex justify-end">
          {/* Scrim */}
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter and sort"
            className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5">
              <h2 className="font-display text-xl text-ink">Filter and Sort</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1 text-ink hover:text-brand"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6">
              <Section title="Sort by">
                {SORT_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-3 text-sm text-ink"
                  >
                    <input
                      type="radio"
                      name="sort"
                      className="size-4 accent-brand"
                      checked={draftSort === option.value}
                      onChange={() => setDraftSort(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </Section>

              {categories.length > 0 && (
                <Section title="Product type">
                  {categories.map((category) => (
                    <label
                      key={category.id}
                      className="flex cursor-pointer items-center gap-3 text-sm text-ink"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-brand"
                        checked={draftCategories.includes(category.slug)}
                        onChange={() =>
                          setDraftCategories((list) =>
                            toggle(list, category.slug),
                          )
                        }
                      />
                      {category.name}
                    </label>
                  ))}
                </Section>
              )}

              {brands.length > 0 && (
                <Section title="Anime">
                  {brands.map((brand) => (
                    <label
                      key={brand.id}
                      className="flex cursor-pointer items-center gap-3 text-sm text-ink"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-brand"
                        checked={draftBrands.includes(brand.slug)}
                        onChange={() =>
                          setDraftBrands((list) => toggle(list, brand.slug))
                        }
                      />
                      {brand.name}
                    </label>
                  ))}
                </Section>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-ink/10 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={clearAll}
              >
                Clear all
              </Button>
              <Button
                type="button"
                className={cn('flex-1 bg-brand text-black hover:bg-brand/90')}
                onClick={apply}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
