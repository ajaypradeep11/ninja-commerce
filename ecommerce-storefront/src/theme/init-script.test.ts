import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_IDS, THEME_STORAGE_KEY } from './registry';
import { themeInitScript } from './init-script';

function runScript() {
  // The script is designed for a bare <head> — no imports, ES5-safe.
  new Function(themeInitScript())();
}

describe('themeInitScript', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.setAttribute('data-theme', 'everloom');
  });

  it('embeds every theme id and the storage key', () => {
    const src = themeInitScript();
    expect(src).toContain(THEME_STORAGE_KEY);
    for (const id of THEME_IDS) expect(src).toContain(id);
  });

  it('applies a valid stored theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'ninja');
    runScript();
    expect(document.documentElement.getAttribute('data-theme')).toBe('ninja');
  });

  it('ignores an invalid stored theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'not-a-theme');
    runScript();
    expect(document.documentElement.getAttribute('data-theme')).toBe('everloom');
  });

  it('does nothing when storage is empty', () => {
    runScript();
    expect(document.documentElement.getAttribute('data-theme')).toBe('everloom');
  });
});
