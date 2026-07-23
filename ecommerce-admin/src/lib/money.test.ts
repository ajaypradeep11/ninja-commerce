import { centsToDollars, dollarsToCents, formatMoney } from './money';

describe('formatMoney', () => {
  it('formats CAD with an explicit code', () => {
    expect(formatMoney(5499, 'CAD')).toBe('CAD $54.99');
  });

  it('formats USD with an explicit code', () => {
    expect(formatMoney(3999, 'USD')).toBe('USD $39.99');
  });

  it('formats zero', () => {
    expect(formatMoney(0, 'CAD')).toBe('CAD $0.00');
  });

  it('groups thousands', () => {
    expect(formatMoney(100000, 'USD')).toBe('USD $1,000.00');
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
