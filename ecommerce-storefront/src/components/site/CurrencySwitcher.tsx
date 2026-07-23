'use client';

import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE } from '@/lib/currency';
import type { Currency } from '@/lib/money';

const OPTIONS: {
  value: Currency;
  flag: string;
  country: string;
  label: string;
}[] = [
  { value: 'CAD', flag: '🇨🇦', country: 'Canada', label: 'CAD $' },
  { value: 'USD', flag: '🇺🇸', country: 'United States', label: 'USD $' },
];

export function CurrencySwitcher({ current }: { current: Currency }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = OPTIONS.find((o) => o.value === current) ?? OPTIONS[0];

  // Close on an outside click or Escape. Hand-rolled rather than pulling in
  // Radix Select: this menu is two items, and the project's Radix Select is
  // known to swallow option clicks under WebKit browser automation.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function choose(currency: Currency) {
    setOpen(false);
    if (currency === current) return;
    document.cookie = `${CURRENCY_COOKIE}=${currency}; max-age=${CURRENCY_COOKIE_MAX_AGE}; path=/; samesite=lax`;
    // Prices are server-rendered, so re-fetch rather than converting in the
    // browser — that keeps one source of truth for what a product costs.
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Currency: ${active.country} (${active.label})`}
        className="flex items-center gap-1.5 rounded-full px-2 py-1.5 font-mono text-xs text-ink hover:text-brand"
      >
        <span aria-hidden className="text-base leading-none">
          {active.flag}
        </span>
        <span className="hidden sm:inline">{active.label}</span>
        <ChevronDown aria-hidden className="size-3.5 text-ink/60" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Currency"
          className="absolute right-0 z-50 mt-2 min-w-52 overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 shadow-lg"
        >
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === current}
              onClick={() => choose(option.value)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-subtle ${
                option.value === current ? 'text-ink' : 'text-ink/70'
              }`}
            >
              <span aria-hidden className="text-base leading-none">
                {option.flag}
              </span>
              <span className="flex-1">{option.country}</span>
              <span className="font-mono text-xs text-ink/60">
                {option.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
