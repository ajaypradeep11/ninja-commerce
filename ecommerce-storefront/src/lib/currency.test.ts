import { parseCurrency, priceFor } from './currency';

describe('parseCurrency', () => {
  it('accepts CAD and USD', () => {
    expect(parseCurrency('CAD')).toBe('CAD');
    expect(parseCurrency('USD')).toBe('USD');
  });

  it('defaults to CAD when absent', () => {
    expect(parseCurrency(undefined)).toBe('CAD');
  });

  it('defaults to CAD for an unrecognised value', () => {
    expect(parseCurrency('EUR')).toBe('CAD');
  });
});

describe('priceFor', () => {
  const product = { priceCents: 5499, priceUsdCents: 3999 };

  it('picks the CAD column', () => {
    expect(priceFor(product, 'CAD')).toBe(5499);
  });

  it('picks the USD column', () => {
    expect(priceFor(product, 'USD')).toBe(3999);
  });
});
