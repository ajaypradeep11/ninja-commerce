import { slugify } from './slugify';

const API_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Organic Cotton Tee')).toBe('organic-cotton-tee');
  });
  it('collapses punctuation and spaces', () => {
    expect(slugify("Kids' Tee — 2-Pack!")).toBe('kids-tee-2-pack');
  });
  it('strips leading/trailing separators', () => {
    expect(slugify('  --Hello--  ')).toBe('hello');
  });
  it('always matches the API slug pattern for non-empty results', () => {
    for (const input of ['A B', 'Über Cool', '99 Problems', 'x']) {
      const slug = slugify(input);
      if (slug) expect(slug).toMatch(API_SLUG_PATTERN);
    }
  });
});
