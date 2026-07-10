import { expect, test } from '@playwright/test';
import { uniqueEmail, visibleText } from './helpers';

// shopper@example.com already has 3+ CANCELLED orders seeded — asserting an
// empty order list or a "no orders yet" state against that account would be
// flaky/wrong. Auth flows below always sign up a fresh user instead.

test.describe('auth', () => {
  test('signup signs the user in, and checkout initiation is exercised', async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail(testInfo);

    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('Passw0rd!');
    await page.getByRole('button', { name: 'Create account' }).click();

    await page.waitForURL('/');
    await expect(page.getByRole('link', { name: 'Account' })).toBeVisible();

    await page.goto('/products/tote-everyday');
    await page.getByRole('button', { name: 'Add to cart' }).click();

    await page.goto('/cart');
    await expect(visibleText(page, 'Everyday Tote')).toBeVisible();
    await page.getByRole('button', { name: 'Checkout' }).click();

    if (process.env.STRIPE_E2E === '1') {
      await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
    } else {
      // Placeholder Stripe key on this machine → API returns 502 → UI shows
      // the provider-error toast, no redirect, cart left untouched.
      await expect(
        visibleText(page, 'Payment provider error — please try again later'),
      ).toBeVisible({
        timeout: 10_000,
      });
      expect(new URL(page.url()).pathname).toBe('/cart');
      await expect(visibleText(page, 'Everyday Tote')).toBeVisible();

      // Confirm the failed checkout attempt didn't sign the user out.
      await page.goto('/account');
      await expect(page).toHaveURL('/account');
      await expect(visibleText(page, email)).toBeVisible();
    }
  });

  test('/account redirects unauthenticated visitors to /login with next', async ({
    page,
  }) => {
    await page.goto('/account');

    await page.waitForURL('/login?next=%2Faccount');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});
