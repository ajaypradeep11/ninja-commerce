import { formatCents } from './money';

test.each([
  [2900, '$29.00'],
  [123, '$1.23'],
  [0, '$0.00'],
  [7999, '$79.99'],
  [100000, '$1,000.00'],
])('formatCents(%i) = %s', (cents, out) => {
  expect(formatCents(cents)).toBe(out);
});
