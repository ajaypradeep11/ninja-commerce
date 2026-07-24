import type { Currency } from './money';

export const CURRENCY_COOKIE = 'localninja.currency';

// A year — the shopper's choice should survive between visits.
export const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// CAD-only store: the dual-currency plumbing (priceUsdCents, priceFor, the
// checkout currency param) stays dormant, but every preference resolves to
// CAD. Re-enable by restoring the cookie parse here and the header switcher.
export function parseCurrency(_raw: string | undefined): Currency {
  return 'CAD';
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
  return 'CAD';
}
