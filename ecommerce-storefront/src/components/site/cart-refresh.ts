import { productsControllerFindBySlug, type ProductResponseDto } from '@/api/generated';
import { ApiError, unwrap } from '@/api/unwrap';
import { removeLine, updateLineMeta, type CartLine } from '@/cart/store';

type LinePatch = Parameters<typeof updateLineMeta>[1];

/**
 * Pure by design: takes the lines and a `fetchBySlug` function, returns what
 * changed without touching the store. Callers (the cart page mount effect,
 * `CheckoutButton`'s error handler) apply the result via `applyCartRefresh`.
 */
export async function refreshCartLines(
  lines: CartLine[],
  fetchBySlug: (slug: string) => Promise<ProductResponseDto>,
): Promise<{ updates: Array<{ productId: string; patch: LinePatch }>; unavailable: string[] }> {
  const results = await Promise.allSettled(lines.map((line) => fetchBySlug(line.slug)));

  const updates: Array<{ productId: string; patch: LinePatch }> = [];
  const unavailable: string[] = [];

  results.forEach((result, i) => {
    const line = lines[i];

    if (result.status === 'rejected') {
      if (result.reason instanceof ApiError && result.reason.status === 404) {
        unavailable.push(line.productId);
      }
      // Other failures (network, 5xx, etc.) — skip, leave the line untouched.
      return;
    }

    const product = result.value;
    const patch: LinePatch = {};
    if (product.priceCents !== line.priceCents) patch.priceCents = product.priceCents;
    if (product.stockQty !== line.stockQty) patch.stockQty = product.stockQty;
    if (product.name !== line.name) patch.name = product.name;
    const image = product.images[0] ?? null;
    if (image !== line.image) patch.image = image;

    if (Object.keys(patch).length > 0) {
      updates.push({ productId: line.productId, patch });
    }
  });

  return { updates, unavailable };
}

function defaultFetchBySlug(slug: string): Promise<ProductResponseDto> {
  return unwrap(productsControllerFindBySlug({ path: { slug } }));
}

/**
 * Non-pure wrapper: runs `refreshCartLines` against the real API and applies
 * the result to the cart store. Shared by the cart page's mount effect and
 * `CheckoutButton`'s 409/404 recovery path.
 */
export async function applyCartRefresh(
  lines: CartLine[],
  fetchBySlug: (slug: string) => Promise<ProductResponseDto> = defaultFetchBySlug,
): Promise<{ removedUnavailable: boolean }> {
  const { updates, unavailable } = await refreshCartLines(lines, fetchBySlug);
  updates.forEach(({ productId, patch }) => updateLineMeta(productId, patch));
  unavailable.forEach((productId) => removeLine(productId));
  return { removedUnavailable: unavailable.length > 0 };
}
