import { SITE } from './site';

test('site config exposes brand and USPs', () => {
  expect(SITE.name).toBe('LocalNinja');
  expect(SITE.wordmark.base + SITE.wordmark.accent).toBe('LocalNinja');
  expect(SITE.usps.length).toBeGreaterThanOrEqual(3);
});
