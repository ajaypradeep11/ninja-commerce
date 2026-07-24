import { formatMoney } from './money';

test.each([
  [5499, 'CAD', 'CAD $54.99'],
  [3999, 'USD', 'USD $39.99'],
  [0, 'CAD', 'CAD $0.00'],
  [100000, 'USD', 'USD $1,000.00'],
] as const)('formatMoney(%i, %s) = %s', (cents, currency, out) => {
  expect(formatMoney(cents, currency)).toBe(out);
});
