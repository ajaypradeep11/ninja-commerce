import { SITE } from './site';

test('site config exposes brand and USPs', () => {
  expect(SITE.name).toBe('NinjaCommerce');
  expect(SITE.wordmark.base + SITE.wordmark.accent).toBe('NinjaCommerce');
  expect(SITE.usps.length).toBeGreaterThanOrEqual(3);
});
