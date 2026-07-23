'use client';

import { useRouter } from 'next/navigation';
import { CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE } from '@/lib/currency';
import type { Currency } from '@/lib/money';

const OPTIONS: { value: Currency; label: string }[] = [
  { value: 'CAD', label: 'CAD $' },
  { value: 'USD', label: 'USD $' },
];

export function CurrencySwitcher({ current }: { current: Currency }) {
  const router = useRouter();

  function choose(currency: Currency) {
    document.cookie = `${CURRENCY_COOKIE}=${currency}; max-age=${CURRENCY_COOKIE_MAX_AGE}; path=/; samesite=lax`;
    // Prices are server-rendered, so re-fetch rather than converting in the
    // browser — that keeps one source of truth for what a product costs.
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Currency">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => choose(option.value)}
          aria-pressed={current === option.value}
          className={
            current === option.value
              ? 'rounded-full bg-ink px-3 py-1 font-mono text-xs text-surface'
              : 'rounded-full px-3 py-1 font-mono text-xs text-ink/60 hover:text-ink'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
