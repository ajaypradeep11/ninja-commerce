import { parseCurrency, priceFor } from './currency';

describe('parseCurrency', () => {
  it('always returns CAD — the store is CAD-only', () => {
    expect(parseCurrency('CAD')).toBe('CAD');
    expect(parseCurrency('USD')).toBe('CAD');
  });

  it('ignores absent or unrecognised preferences', () => {
    expect(parseCurrency(undefined)).toBe('CAD');
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
