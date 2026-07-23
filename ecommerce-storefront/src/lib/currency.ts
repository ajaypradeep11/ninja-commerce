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
