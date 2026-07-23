import { formatCents } from './money';

// Prices are charged in CAD (ecommerce-api checkout.service.ts sets
// CURRENCY = 'cad'), so the currency is spelled out: a bare "$" reads as USD
// to plenty of visitors, and the policy copy in src/lib/site.ts already
// quotes "$65 CAD".
test.each([
  [2900, '$29.00 CAD'],
  [123, '$1.23 CAD'],
  [0, '$0.00 CAD'],
  [7999, '$79.99 CAD'],
  [100000, '$1,000.00 CAD'],
])('formatCents(%i) = %s', (cents, out) => {
  expect(formatCents(cents)).toBe(out);
});
