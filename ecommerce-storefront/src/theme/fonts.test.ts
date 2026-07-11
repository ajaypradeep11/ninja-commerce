import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Vite statically rewrites literal `new URL('./x', import.meta.url)` —
// indirection keeps it a real file:// URL under vitest (same trick as
// theme-css.test.ts).
const hereUrl = import.meta.url;
const fontsSource = readFileSync(new URL('./fonts.ts', hereUrl), 'utf8');
const themesCss = readFileSync(new URL('./themes.css', hereUrl), 'utf8');

// fonts.ts is a next/font config module: its loaders only execute under
// Next's compiler, so this test parses SOURCE TEXT and never imports it.

function declaredFontVars(): string[] {
  return [...fontsSource.matchAll(/variable:\s*['"](--font-[a-z0-9-]+)['"]/g)].map(
    (m) => m[1],
  );
}

function referencedFontVars(): string[] {
  return [
    ...new Set(
      [...themesCss.matchAll(/var\((--font-[a-z0-9-]+)\s*[,)]/g)].map((m) => m[1]),
    ),
  ];
}

describe('fonts.ts ↔ themes.css sync', () => {
  it('declares no duplicate font variables', () => {
    const declared = declaredFontVars();
    expect(new Set(declared).size).toBe(declared.length);
  });

  it('every font variable referenced in themes.css is loaded in fonts.ts', () => {
    const declared = new Set(declaredFontVars());
    const missing = referencedFontVars().filter((v) => !declared.has(v));
    expect(
      missing,
      `themes.css uses ${missing.join(', ')} but src/theme/fonts.ts loads no such font — add the loader (see the recipe at the top of fonts.ts)`,
    ).toEqual([]);
  });

  it('every font loaded in fonts.ts is referenced by some theme', () => {
    const referenced = new Set(referencedFontVars());
    const dead = declaredFontVars().filter((v) => !referenced.has(v));
    expect(
      dead,
      `fonts.ts loads ${dead.join(', ')} but no theme in themes.css references it — delete the unused loader`,
    ).toEqual([]);
  });

  it('every loader is included in THEME_FONTS', () => {
    // Each loader is `const <name> = Family({...})`; THEME_FONTS must list
    // every declared const exactly once.
    const consts = [
      ...fontsSource.matchAll(/^(?:export\s+)?const\s+(\w+)\s*=\s*\w+\(/gm),
    ].map((m) => m[1]);
    const arrayMatch = fontsSource.match(
      /THEME_FONTS\s*(?::[^=]+)?=\s*\[([^\]]*)\]/s,
    );
    expect(arrayMatch, 'THEME_FONTS array literal not found').toBeTruthy();
    const listed = arrayMatch![1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    expect([...listed].sort()).toEqual([...consts].sort());
  });

  it('regexes handle export/double-quote/digit/fallback forms (guard hardening)', () => {
    expect('export const s3 = Source_Sans_3({ variable: "--font-source-sans-3" })').toMatch(/variable:\s*['"](--font-[a-z0-9-]+)['"]/);
    expect('export const x = F(').toMatch(/^(?:export\s+)?const\s+(\w+)\s*=\s*\w+\(/m);
    expect([...'--font-display: var(--font-source-sans-3, serif);'.matchAll(/var\((--font-[a-z0-9-]+)\s*[,)]/g)][0][1]).toBe('--font-source-sans-3');
  });
});
