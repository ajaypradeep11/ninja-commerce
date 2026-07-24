import type { Currency } from './money';

export const CURRENCY_COOKIE = 'localninja.currency';

// A year — the shopper's choice should survive between visits.
export const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Anything unrecognised falls back to the home currency rather than throwing:
// a stale or hand-edited cookie must never break a page render.
export function parseCurrency(raw: string | undefined): Currency {
  return raw === 'USD' ? 'USD' : 'CAD';
}

// One place decides which column a currency reads, so the eight components that
// render prices cannot drift apart.
export function priceFor(
  product: { priceCents: number; priceUsdCents: number },
  currency: Currency,
): number {
  return currency === 'USD' ? product.priceUsdCents : product.priceCents;
}

// Client Components (e.g. the cart page) can't call next/headers' cookies(),
// so they read document.cookie directly. Kept alongside parseCurrency so the
// two never disagree on what a missing/malformed cookie defaults to.
export function readClientCurrency(): Currency {
  if (typeof document === 'undefined') return 'CAD';
  const match = document.cookie.match(/(?:^|;\s*)localninja\.currency=([^;]*)/);
  return parseCurrency(match ? decodeURIComponent(match[1]) : undefined);
}
