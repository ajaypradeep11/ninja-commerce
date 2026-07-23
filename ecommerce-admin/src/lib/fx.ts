import { dollarsToCents } from './money';

// Seeds the "Autofill from CAD" button only. It is a starting suggestion the
// admin edits, never a live conversion — prices are stored per currency and
// nothing recomputes them later. Edit this one number when it drifts too far.
export const CAD_TO_USD = 0.73;

export function suggestUsdFromCad(cadDollars: string): string {
  const cents = dollarsToCents(cadDollars);
  if (cents === null) return '';
  // Charm pricing: round down to the whole dollar below the raw conversion,
  // then land a cent short of it (…$39.99 rather than …$40.00) so
  // suggestions look like real prices.
  const usdCents = Math.floor((cents * CAD_TO_USD) / 100) * 100 - 1;
  return (usdCents / 100).toFixed(2);
}
