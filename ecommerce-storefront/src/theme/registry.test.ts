import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  THEME_IDS,
  THEME_STORAGE_KEY,
  THEMES,
  resolveTheme,
} from './registry';

describe('resolveTheme', () => {
  it.each(THEME_IDS)('passes through valid id %s', (id) => {
    expect(resolveTheme(id)).toBe(id);
  });

  it.each([undefined, null, '', 'EVERLOOM', 'solar', 42, {}])(
    'falls back to the default theme for %j',
    (value) => {
      expect(resolveTheme(value)).toBe(DEFAULT_THEME);
    },
  );
});

describe('registry', () => {
  it('has one THEMES entry per id, in order', () => {
    expect(THEMES.map((t) => t.id)).toEqual([...THEME_IDS]);
  });

  it('every theme has a label and 3 hex swatches', () => {
    for (const t of THEMES) {
      expect(t.label.length).toBeGreaterThan(0);
      for (const hex of Object.values(t.swatches)) {
        expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('every theme has a boolean dark flag', () => {
    for (const t of THEMES) {
      expect(typeof t.dark).toBe('boolean');
    }
  });

  it('exposes the storage key', () => {
    expect(THEME_STORAGE_KEY).toBe('storefront.theme.v2');
  });
});
