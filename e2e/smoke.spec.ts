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
        name: "Basics you'll wear out before they wear down.",
      }),
    ).toBeVisible();

    expect(await productCards(page).count()).toBeGreaterThanOrEqual(8);

    await expect(page.locator('.marquee-track').first()).toBeVisible();
    await expect(page.locator('.marquee-track').first()).toContainText(
      'EVERLOOM',
    );
  });

  test('category filter shows tees with out-of-stock badge', async ({
    page,
  }) => {
    await page.goto('/products?category=tees');

    await expect(productCards(page)).toHaveCount(4);

    const pocketTee = productCards(page).filter({
      hasText: 'Pocket Tee — Madder',
    });
    await expect(pocketTee).toBeVisible();
    await expect(pocketTee.getByText('OUT OF STOCK')).toBeVisible();
  });

  test('sort by price puts the cheapest item first', async ({ page }) => {
    await page.goto('/products?sort=price_asc');

    await expect(productCards(page).first()).toContainText('Everyday Tote');
  });

  test('full listing shows all products with no pagination control', async ({
    page,
  }) => {
    await page.goto('/products');

    await expect(visibleText(page, '11 PRODUCTS')).toBeVisible();
    await expect(productCards(page)).toHaveCount(11);
    await expect(
      page.getByRole('navigation', { name: 'Pagination' }),
    ).toHaveCount(0);
  });
});

test.describe('cart', () => {
  test('add to cart clamps quantity and cart math updates on change/remove', async ({
    page,
  }) => {
    await page.goto('/products/heavyweight-hoodie');

    await expect(visibleText(page, 'Only 3 left')).toBeVisible();

    const increase = page.getByRole('button', { name: 'Increase quantity' });
    await increase.click();
    await increase.click();

    await page.getByRole('button', { name: 'Add to cart' }).click();

    await expect(page.getByLabel('Cart, 3 items')).toBeVisible();

    await page.goto('/cart');

    await expect(visibleText(page, 'Heavyweight Hoodie')).toBeVisible();
    await expect(visibleText(page, '$237.00')).toHaveCount(2); // line total + subtotal

    await page.getByRole('button', { name: 'Decrease quantity' }).click();

    await expect(visibleText(page, '$158.00')).toHaveCount(2);

    await page
      .getByRole('button', { name: 'Remove Heavyweight Hoodie' })
      .click();

    await expect(visibleText(page, 'Your cart is empty.')).toBeVisible();
  });
});
