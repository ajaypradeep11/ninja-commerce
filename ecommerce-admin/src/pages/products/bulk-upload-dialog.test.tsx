import { describe, expect, it } from 'vitest';
import { validateRow } from './bulk-upload-dialog';

const cats = new Set(['anime lamps']);

describe('validateRow', () => {
  it('accepts a valid row, converts price to cents, matches category case-insensitively', () => {
    const r = validateRow(
      { name: 'Naruto Lamp', description: 'cool', price: '49.99', priceUsd: '36.99', stock: '10', category: 'Anime Lamps' },
      1,
      cats,
    );
    expect(r.error).toBeUndefined();
    expect(r.item).toEqual({
      name: 'Naruto Lamp',
      description: 'cool',
      priceCents: 4999,
      priceUsdCents: 3699,
      stockQty: 10,
      categoryName: 'Anime Lamps',
      active: true,
    });
  });

  it('defaults active to true and parses explicit false', () => {
    expect(validateRow({ name: 'A', price: '1', priceUsd: '1', stock: '1', category: 'anime lamps' }, 1, cats).item?.active).toBe(true);
    expect(validateRow({ name: 'A', price: '1', priceUsd: '1', stock: '1', category: 'anime lamps', active: 'false' }, 1, cats).item?.active).toBe(false);
  });

  it('flags empty name', () => {
    expect(validateRow({ name: '  ', price: '1', priceUsd: '1', stock: '1', category: 'anime lamps' }, 3, cats)).toMatchObject({ row: 3, error: 'name is required' });
  });

  it('flags invalid price and stock', () => {
    expect(validateRow({ name: 'A', price: '-1', priceUsd: '1', stock: '1', category: 'anime lamps' }, 1, cats).error).toBe('invalid price');
    expect(validateRow({ name: 'A', price: 'abc', priceUsd: '1', stock: '1', category: 'anime lamps' }, 1, cats).error).toBe('invalid price');
    expect(validateRow({ name: 'A', price: '1', priceUsd: '1', stock: '1.5', category: 'anime lamps' }, 1, cats).error).toBe('invalid stock');
  });

  it('flags an unknown category', () => {
    expect(validateRow({ name: 'A', price: '1', priceUsd: '1', stock: '1', category: 'Nope' }, 2, cats).error).toBe('unknown category "Nope"');
  });

  it('rejects a row with no USD price', () => {
    const r = validateRow(
      { name: 'Naruto Lamp', description: 'cool', price: '49.99', priceUsd: '', stock: '10', category: 'Anime Lamps' },
      1,
      cats,
    );
    expect(r.error).toBe('invalid USD price');
  });

  it('converts both prices to cents', () => {
    const r = validateRow(
      { name: 'Naruto Lamp', description: 'cool', price: '49.99', priceUsd: '36.99', stock: '10', category: 'Anime Lamps' },
      1,
      cats,
    );
    expect(r.item).toMatchObject({ priceCents: 4999, priceUsdCents: 3699 });
  });
});
