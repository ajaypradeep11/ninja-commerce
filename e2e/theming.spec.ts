import { expect, test } from '@playwright/test';

// Fresh context per test = clean localStorage; no cross-test theme leakage.
test('theme switcher applies, restyles, and persists across reload', async ({
  page,
}) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'everloom');

  const before = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );

  await page
    .getByRole('button', { name: 'Switch to Ninja theme' })
    .click();

  await expect(html).toHaveAttribute('data-theme', 'ninja');
  const after = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  expect(after).not.toBe(before);
  // ninja surface is #0a0a0a
  expect(after).toBe('rgb(10, 10, 10)');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'ninja');
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe('rgb(10, 10, 10)');
});
