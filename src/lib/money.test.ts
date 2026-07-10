import { centsToDollars, dollarsToCents, formatUsd } from './money';

describe('formatUsd', () => {
  it('formats cents as USD', () => {
    expect(formatUsd(2900)).toBe('$29.00');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(123456)).toBe('$1,234.56');
  });
});

describe('centsToDollars', () => {
  it('renders a plain decimal string for form defaults', () => {
    expect(centsToDollars(2900)).toBe('29.00');
    expect(centsToDollars(5)).toBe('0.05');
  });
});

describe('dollarsToCents', () => {
  it('parses whole dollars', () => expect(dollarsToCents('29')).toBe(2900));
  it('parses one decimal place', () => expect(dollarsToCents('29.5')).toBe(2950));
  it('parses two decimal places', () => expect(dollarsToCents('29.99')).toBe(2999));
  it('trims whitespace', () => expect(dollarsToCents(' 10.00 ')).toBe(1000));
  it('rejects negatives', () => expect(dollarsToCents('-5')).toBeNull());
  it('rejects three decimals', () => expect(dollarsToCents('1.999')).toBeNull());
  it('rejects non-numbers', () => expect(dollarsToCents('abc')).toBeNull());
  it('rejects empty', () => expect(dollarsToCents('')).toBeNull());
});
