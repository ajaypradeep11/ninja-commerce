import { expect, test } from '@playwright/test';

// Fresh context per test = clean localStorage; no cross-test theme leakage.
test('theme switcher applies, restyles, and persists across reload', async ({
  page,
}) => {
  await page.goto('/');
  const html = page.locator('html');
  // Default theme is ninja (surface #0a0a0a).
  await expect(html).toHaveAttribute('data-theme', 'ninja');

  const before = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  expect(before).toBe('rgb(10, 10, 10)');

  // Switch to a different (light) theme to prove switching restyles the page.
  await page
    .getByRole('button', { name: 'Switch to Everloom theme' })
    .click();

  await expect(html).toHaveAttribute('data-theme', 'everloom');
  const after = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  expect(after).not.toBe(before);
  // everloom surface is #faf7f2
  expect(after).toBe('rgb(250, 247, 242)');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'everloom');
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe('rgb(250, 247, 242)');
});
