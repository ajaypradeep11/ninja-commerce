'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import type { BrandResponseDto } from '@/api/generated';

const NAV = [
  { href: '/products', label: 'Shop' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
];

export function HeaderMenu({ brands }: { brands: BrandResponseDto[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close when navigating or pressing Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div ref={panelRef}>
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 text-ink hover:text-brand"
      >
        {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
      </button>

      {open && (
        <nav
          aria-label="Main"
          className="absolute inset-x-0 top-full z-40 border-b border-ink/10 bg-surface"
        >
          <div className="container-wide py-4">
            <ul className="flex flex-col gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block py-2 font-display text-2xl text-ink hover:text-brand"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            {brands.length > 0 && (
              <div className="mt-4 border-t border-ink/10 pt-4">
                <p className="font-mono text-xs tracking-wide text-ink/60">ANIME</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {brands.map((brand) => (
                    <li key={brand.id}>
                      <Link
                        href={`/products?brand=${brand.slug}`}
                        className="block py-1.5 font-display text-lg text-ink hover:text-brand"
                      >
                        {brand.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
