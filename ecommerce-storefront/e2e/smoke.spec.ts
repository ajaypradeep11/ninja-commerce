import { expect, test } from '@playwright/test';
import { visibleText } from './helpers';

// Product card links always point at /products/<slug>; scoping to <main>
// keeps the count from picking up the "Shop"/"All products" nav links in
// the header and footer, which point at the bare /products path. Filtering
// to visible elements guards against the transient hidden-duplicate DOM
// nodes that Next's dev-mode streaming SSR can leave behind mid-swap (see
// helpers.ts for details) — without it, card counts can occasionally come
// back doubled.
function productCards(page: import('@playwright/test').Page) {
  return page.locator('main a[href^="/products/"]').filter({ visible: true });
}

test.describe('browse', () => {
  test('home renders hero, product grid, and footer marquee', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Your favorite anime, in a whole new light.',
      }),
    ).toBeVisible();

    expect(await productCards(page).count()).toBeGreaterThanOrEqual(8);

    await expect(page.locator('.marquee-track').first()).toBeVisible();
    await expect(page.locator('.marquee-track').first()).toContainText(
      'NINJACOMMERCE',
    );
  });

  test('category filter shows anime lamps with out-of-stock badge', async ({
    page,
  }) => {
    await page.goto('/products?category=anime-lamps');

    await expect(productCards(page)).toHaveCount(12);

    const dragonBall = productCards(page).filter({
      hasText: 'Dragon Ball LED Lamp',
    });
    await expect(dragonBall).toBeVisible();
    await expect(dragonBall.getByText('OUT OF STOCK')).toBeVisible();
  });

  test('sort by price puts the cheapest item first', async ({ page }) => {
    await page.goto('/products?sort=price_asc');

    await expect(productCards(page).first()).toContainText(
      'BT21 Halloween LED Lamp',
    );
  });

  test('full listing paginates the anime catalog', async ({ page }) => {
    await page.goto('/products');

    await expect(visibleText(page, '20 PRODUCTS')).toBeVisible();
    await expect(productCards(page)).toHaveCount(12);
    await expect(
      page.getByRole('navigation', { name: 'Pagination' }),
    ).toBeVisible();
  });
});

test.describe('cart', () => {
  test('add to cart clamps quantity and cart math updates on change/remove', async ({
    page,
  }) => {
    await page.goto('/products/guts-led-lamp');

    await expect(visibleText(page, 'Only 3 left')).toBeVisible();

    const increase = page.getByRole('button', { name: 'Increase quantity' });
    await increase.click();
    await increase.click();

    await page.getByRole('button', { name: 'Add to cart' }).click();

    await expect(page.getByLabel('Cart, 3 items')).toBeVisible();

    await page.goto('/cart');

    await expect(visibleText(page, 'Guts LED Lamp')).toBeVisible();
    await expect(visibleText(page, '$237.00')).toHaveCount(2); // line total + subtotal

    await page.getByRole('button', { name: 'Decrease quantity' }).click();

    await expect(visibleText(page, '$158.00')).toHaveCount(2);

    await page
      .getByRole('button', { name: 'Remove Guts LED Lamp' })
      .click();

    await expect(visibleText(page, 'Your cart is empty.')).toBeVisible();
  });
});
