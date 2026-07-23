export type Currency = 'CAD' | 'USD';

// The store sells in two dollar currencies, so a bare "$" is ambiguous — the
// code is always spelled out. Amounts are charged exactly as shown: both prices
// are entered by hand in admin and nothing is converted at request time.
export function formatMoney(cents: number, currency: Currency): string {
  const amount = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(cents / 100);
  // en-CA renders USD as "US$39.99" and CAD as "$54.99" — normalise to a bare
  // "$" so the explicit prefix is the only currency marker.
  return `${currency} ${amount.replace(/^US\$/, '$').replace(/^CA\$/, '$')}`;
}
