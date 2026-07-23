import { suggestUsdFromCad } from './fx';

describe('suggestUsdFromCad', () => {
  it('converts and rounds up to charm pricing', () => {
    expect(suggestUsdFromCad('54.99')).toBe('39.99');
  });

  it('returns an empty string for an unparseable price', () => {
    expect(suggestUsdFromCad('abc')).toBe('');
  });

  it('returns an empty string for an empty input', () => {
    expect(suggestUsdFromCad('')).toBe('');
  });
});
