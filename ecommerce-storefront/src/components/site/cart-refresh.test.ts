import type { ProductResponseDto } from '@/api/generated';
import { ApiError } from '@/api/unwrap';
import type { CartLine } from '@/cart/store';
import { refreshCartLines } from './cart-refresh';

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 'prod_1',
    slug: 'heavyweight-hoodie',
    name: 'Heavyweight Hoodie',
    priceCents: 7900,
    image: 'https://picsum.photos/seed/heavyweight-hoodie-1/900/1125',
    quantity: 2,
    stockQty: 40,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<ProductResponseDto> = {}): ProductResponseDto {
  return {
    id: 'prod_1',
    name: 'Heavyweight Hoodie',
    slug: 'heavyweight-hoodie',
    description: 'A cozy, heavyweight hoodie.',
    priceCents: 7900,
    priceUsdCents: 5900,
    images: ['https://picsum.photos/seed/heavyweight-hoodie-1/900/1125'],
    stockQty: 40,
    active: true,
    categoryId: 'cat_1',
    brandId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    averageRating: 4.5,
    reviewCount: 8,
    ...overrides,
  };
}

describe('refreshCartLines', () => {
  it('returns no updates when the line matches the current product exactly', async () => {
    const line = makeLine();
    const fetchBySlug = vi.fn().mockResolvedValue(makeProduct());

    const result = await refreshCartLines([line], fetchBySlug, 'CAD');

    expect(result).toEqual({ updates: [], unavailable: [] });
  });

  it('patches priceCents when the price has drifted', async () => {
    const line = makeLine({ priceCents: 7900 });
    const fetchBySlug = vi.fn().mockResolvedValue(makeProduct({ priceCents: 8500 }));

    const result = await refreshCartLines([line], fetchBySlug, 'CAD');

    expect(result.updates).toEqual([{ productId: 'prod_1', patch: { priceCents: 8500 } }]);
    expect(result.unavailable).toEqual([]);
  });

  it('patches stockQty when stock has dropped', async () => {
    const line = makeLine({ quantity: 3, stockQty: 40 });
    const fetchBySlug = vi.fn().mockResolvedValue(makeProduct({ stockQty: 1 }));

    const result = await refreshCartLines([line], fetchBySlug, 'CAD');

    expect(result.updates).toEqual([{ productId: 'prod_1', patch: { stockQty: 1 } }]);
  });

  it('patches stockQty to 0 (out-of-stock state) — the store clamps quantity to 1, not 0', async () => {
    const line = makeLine({ quantity: 3, stockQty: 40 });
    const fetchBySlug = vi.fn().mockResolvedValue(makeProduct({ stockQty: 0 }));

    const result = await refreshCartLines([line], fetchBySlug, 'CAD');

    expect(result.updates).toEqual([{ productId: 'prod_1', patch: { stockQty: 0 } }]);
    expect(result.unavailable).toEqual([]);
  });

  it('patches name and image when they have drifted', async () => {
    const line = makeLine();
    const fetchBySlug = vi.fn().mockResolvedValue(
      makeProduct({ name: 'Heavyweight Hoodie (Updated)', images: ['https://picsum.photos/seed/new/900/1125'] }),
    );

    const result = await refreshCartLines([line], fetchBySlug, 'CAD');

    expect(result.updates).toEqual([
      {
        productId: 'prod_1',
        patch: {
          name: 'Heavyweight Hoodie (Updated)',
          image: 'https://picsum.photos/seed/new/900/1125',
        },
      },
    ]);
  });

  it('sets image patch to null when the product no longer has images', async () => {
    const line = makeLine({ image: 'https://picsum.photos/seed/old/900/1125' });
    const fetchBySlug = vi.fn().mockResolvedValue(makeProduct({ images: [] }));

    const result = await refreshCartLines([line], fetchBySlug, 'CAD');

    expect(result.updates).toEqual([{ productId: 'prod_1', patch: { image: null } }]);
  });

  it('lists the productId as unavailable when the fetch rejects with a 404 ApiError', async () => {
    const line = makeLine();
    const fetchBySlug = vi.fn().mockRejectedValue(new ApiError(404, 'Not found'));

    const result = await refreshCartLines([line], fetchBySlug, 'CAD');

    expect(result).toEqual({ updates: [], unavailable: ['prod_1'] });
  });

  it('leaves the line untouched when the fetch fails for a non-404 reason', async () => {
    const line = makeLine();
    const fetchBySlug = vi.fn().mockRejectedValue(new ApiError(500, 'Server error'));

    const result = await refreshCartLines([line], fetchBySlug, 'CAD');

    expect(result).toEqual({ updates: [], unavailable: [] });
  });

  it('leaves the line untouched on a plain network rejection', async () => {
    const line = makeLine();
    const fetchBySlug = vi.fn().mockRejectedValue(new Error('network down'));

    const result = await refreshCartLines([line], fetchBySlug, 'CAD');

    expect(result).toEqual({ updates: [], unavailable: [] });
  });

  it('patches the line with the USD price when USD is active', async () => {
    const line = makeLine({ priceCents: 2900 });
    const fetchBySlug = vi.fn().mockResolvedValue(
      makeProduct({ priceCents: 2900, priceUsdCents: 2100 }),
    );

    const result = await refreshCartLines([line], fetchBySlug, 'USD');

    expect(result.updates[0].patch.priceCents).toBe(2100);
  });

  it('handles multiple lines independently via Promise.allSettled', async () => {
    const okLine = makeLine({ productId: 'prod_1', slug: 'heavyweight-hoodie' });
    const goneLine = makeLine({ productId: 'prod_2', slug: 'discontinued-tote', name: 'Tote' });
    const driftedLine = makeLine({ productId: 'prod_3', slug: 'canvas-tote', priceCents: 4000 });

    const fetchBySlug = vi.fn((slug: string) => {
      if (slug === 'heavyweight-hoodie') return Promise.resolve(makeProduct());
      if (slug === 'discontinued-tote') return Promise.reject(new ApiError(404, 'Not found'));
      if (slug === 'canvas-tote') return Promise.resolve(makeProduct({ id: 'prod_3', priceCents: 4500 }));
      throw new Error('unexpected slug');
    });

    const result = await refreshCartLines([okLine, goneLine, driftedLine], fetchBySlug, 'CAD');

    expect(result.unavailable).toEqual(['prod_2']);
    expect(result.updates).toEqual([{ productId: 'prod_3', patch: { priceCents: 4500 } }]);
  });
});
