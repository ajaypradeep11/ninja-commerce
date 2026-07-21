import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEME_IDS, THEMES } from './registry';

// NB: import.meta.url is assigned to a variable before use here (rather than
// passed inline) because Vite statically pattern-matches the literal
// `new URL('...', import.meta.url)` form and rewrites it as an asset-URL
// reference — under the jsdom test environment that resolves to
// http://localhost:3000/... instead of a real file:// path, which breaks
// readFileSync regardless of whether themes.css exists. The indirection
// defeats Vite's static analysis so import.meta.url passes through as the
// genuine file:// URL of this test module.
const themeCssModuleUrl = import.meta.url;
const css = readFileSync(new URL('./themes.css', themeCssModuleUrl), 'utf8');

// Matches only the bare block: [data-theme='id'] { ... } — not descendant
// selectors like [data-theme='id'] .selvedge { ... }.
function themeBlock(id: string): string {
  const m = css.match(new RegExp(`\\[data-theme='${id}'\\]\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`no [data-theme='${id}'] block in themes.css`);
  return m[1];
}

function colorVar(block: string, role: string): string {
  const m = block.match(new RegExp(`--color-${role}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`--color-${role} missing or not a 6-digit hex`);
  return m[1].toLowerCase();
}

// WCAG 2.x relative luminance + contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('themes.css ↔ registry sync', () => {
  it.each(THEME_IDS)('has a [data-theme] block for %s', (id) => {
    expect(themeBlock(id)).toBeTruthy();
  });

  it.each(THEME_IDS)('%s block defines all five roles and --radius', (id) => {
    const block = themeBlock(id);
    for (const role of ['surface', 'ink', 'brand', 'highlight', 'subtle']) {
      expect(colorVar(block, role)).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(block).toMatch(/--radius:\s*[\d.]+rem|--radius:\s*0(?![\d.])/);
  });

  it.each(THEMES)('registry swatches match CSS for $id', (t) => {
    const block = themeBlock(t.id);
    expect(colorVar(block, 'surface')).toBe(t.swatches.surface);
    expect(colorVar(block, 'brand')).toBe(t.swatches.brand);
    expect(colorVar(block, 'highlight')).toBe(t.swatches.highlight);
  });
});

describe('WCAG AA contrast audit', () => {
  it.each(THEME_IDS)('%s passes all text-contrast pairs', (id) => {
    const block = themeBlock(id);
    const c = (role: string) => colorVar(block, role);
    // ink on surface — body text
    expect(contrast(c('ink'), c('surface'))).toBeGreaterThanOrEqual(4.5);
    // Brand-colored text on surface — links and labels. A theme may keep a
    // vivid brand fill and define --color-brand-text for type; when it does,
    // that is the color a reader actually sees, so audit that one.
    const brandText = /--color-brand-text:\s*#/.test(block)
      ? colorVar(block, 'brand-text')
      : c('brand');
    expect(contrast(brandText, c('surface'))).toBeGreaterThanOrEqual(4.5);
    // highlight on surface — error/sale text
    expect(contrast(c('highlight'), c('surface'))).toBeGreaterThanOrEqual(4.5);
    // ink on subtle — text on muted panels (footer, badges)
    expect(contrast(c('ink'), c('subtle'))).toBeGreaterThanOrEqual(4.5);
  });
});
