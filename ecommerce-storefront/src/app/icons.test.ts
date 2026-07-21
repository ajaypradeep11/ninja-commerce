import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Vite statically rewrites literal `new URL('./x', import.meta.url)` —
// indirection keeps it a real file:// URL under vitest (same trick as
// fonts.test.ts).
const hereUrl = import.meta.url;
const layoutSource = readFileSync(new URL('./layout.tsx', hereUrl), 'utf8');
const manifestSource = readFileSync(new URL('./manifest.ts', hereUrl), 'utf8');
const appDir = new URL('./', hereUrl);
const publicDir = new URL('../../public/', hereUrl);

// layout.tsx and manifest.ts are Next modules whose imports (next/font, the
// site config) only resolve under Next's compiler, so this test reads SOURCE
// TEXT rather than importing them.
function referencedIcons(source: string): string[] {
  return [...source.matchAll(/['"](\/[\w./-]+\.(?:png|svg))['"]/g)].map((m) => m[1]);
}

describe('app icons', () => {
  it('serves icons from public/ rather than app/ convention files', () => {
    // Next keys app/icon.* and app/apple-icon.* by BASENAME, so icon.png and
    // icon.svg collide: both routes serve whichever it resolved first, with
    // that file's content-type. Prod shipped a PNG at /icon.svg this way.
    // Keeping the files in public/ and declaring metadata.icons avoids it.
    const offenders = readdirSync(appDir).filter((f) =>
      /^(icon|apple-icon|favicon)\d*\.(png|svg|jpe?g|ico)$/.test(f),
    );
    expect(offenders).toEqual([]);
  });

  it('references icons that actually exist', () => {
    const referenced = [
      ...referencedIcons(layoutSource),
      ...referencedIcons(manifestSource),
    ];

    // Guards against the metadata and the manifest drifting apart from the
    // files, which fails silently in a browser.
    expect(referenced.length).toBeGreaterThan(0);
    for (const url of referenced) {
      expect(existsSync(new URL(`.${url}`, publicDir)), `missing ${url}`).toBe(true);
    }
  });
});
