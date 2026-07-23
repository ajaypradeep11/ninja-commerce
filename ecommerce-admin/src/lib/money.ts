// Orders are charged in either CAD or USD, so the code is always spelled out —
// a bare "$" is ambiguous between the two currencies the store actually sells in.
export function formatMoney(cents: number, currency: 'CAD' | 'USD'): string {
  const amount = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
  }).format(cents / 100);
  // en-CA renders USD as "US$39.99"; normalise both to a bare "$" so the
  // explicit prefix below is the only currency marker.
  return `${currency} ${amount.replace(/^US\$/, '$').replace(/^CA\$/, '$')}`;
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function dollarsToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [dollars, fraction = ''] = trimmed.split('.');
  return Number(dollars) * 100 + Number(fraction.padEnd(2, '0') || '0');
}
