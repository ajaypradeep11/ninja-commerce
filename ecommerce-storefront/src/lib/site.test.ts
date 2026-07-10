import { SITE } from './site';

test('site config exposes brand and USPs', () => {
  expect(SITE.name).toBe('Everloom');
  expect(SITE.usps.length).toBeGreaterThanOrEqual(3);
});
