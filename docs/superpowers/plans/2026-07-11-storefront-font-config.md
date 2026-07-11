# Storefront Font Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all `next/font` loader calls out of `layout.tsx` into a documented single-edit-point config `src/theme/fonts.ts`, guarded by a source-parsing sync test against `themes.css`.

**Architecture:** `next/font` loaders are compile-time transforms (must stay static, literal, module-scope), so the "config" is the file containing the loader calls. `fonts.ts` exports `THEME_FONTS` and `fontVariables`; `layout.tsx` consumes only `fontVariables`. The sync test reads both files as source text (never imports `fonts.ts`) and fails on any drift in either direction.

**Tech Stack:** Next.js 15 `next/font/google`, Vitest (node fs source parsing, same technique as `theme-css.test.ts`).

**Spec:** `/Users/ajaypradeepm/Work/Ecommerce/docs/superpowers/specs/2026-07-11-storefront-font-config-design.md`

## Global Constraints

- Repo: `/Users/ajaypradeepm/Work/Ecommerce/ecommerce-storefront` — work on branch `font-config` (create from `master` in Task 1).
- Behavior-neutral refactor: rendered HTML must be identical (same 12 fonts, same `--font-<name>` variable names, same weights, same preload flags — only everloom's bricolage/public-sans/plex-mono preload).
- The sync test must NOT import `fonts.ts` (next/font loaders only run under Next's compiler; runtime `.variable` is a hashed class name). Source-text parsing only.
- Sync failures are hard failures in BOTH directions: CSS references an undeclared font, or a declared font is unreferenced by every theme.
- Existing suite (171 unit + 8 e2e) stays green; test output pristine.
- Dev server runs on port 3005 on this machine.
- In test files, never write literal `new URL('./x', import.meta.url)` — Vite statically rewrites it and breaks `readFileSync`; assign `import.meta.url` to a variable first (see existing `src/theme/theme-css.test.ts`).

## File Structure (end state)

```
src/theme/fonts.ts        # NEW: all next/font loaders + THEME_FONTS + fontVariables + forker recipe
src/theme/fonts.test.ts   # NEW: fonts.ts ↔ themes.css sync test (source parsing)
src/app/layout.tsx        # loaders deleted; imports { fontVariables } from '@/theme/fonts'
THEMING.md                # fonts step points at src/theme/fonts.ts
```

---

### Task 1: fonts.ts config + layout refactor + sync test (TDD)

**Files:**
- Create: `src/theme/fonts.ts`
- Test: `src/theme/fonts.test.ts`
- Modify: `src/app/layout.tsx` (delete lines 2–15 font imports, 24–56 loader block; add one import)

**Interfaces:**
- Consumes: `src/theme/themes.css` font-role mappings (`var(--font-…)` references, unchanged).
- Produces: `fontVariables: string` (joined className string) and `THEME_FONTS: readonly NextFontWithVariable[]` from `@/theme/fonts` — layout.tsx and the docs rely on these exact names.

- [ ] **Step 1: Create the branch**

```bash
cd /Users/ajaypradeepm/Work/Ecommerce/ecommerce-storefront
git checkout master && git checkout -b font-config
```

- [ ] **Step 2: Write the failing sync test**

`src/theme/fonts.test.ts`:

```ts
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
  return [...fontsSource.matchAll(/variable:\s*'(--font-[a-z-]+)'/g)].map(
    (m) => m[1],
  );
}

function referencedFontVars(): string[] {
  return [
    ...new Set(
      [...themesCss.matchAll(/var\((--font-[a-z-]+)\)/g)].map((m) => m[1]),
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
      ...fontsSource.matchAll(/^const\s+(\w+)\s*=\s*\w+\(/gm),
    ].map((m) => m[1]);
    const arrayMatch = fontsSource.match(
      /THEME_FONTS\s*=\s*\[([^\]]*)\]/s,
    );
    expect(arrayMatch, 'THEME_FONTS array literal not found').toBeTruthy();
    const listed = arrayMatch![1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    expect([...listed].sort()).toEqual([...consts].sort());
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/theme/fonts.test.ts`
Expected: FAIL — ENOENT, `src/theme/fonts.ts` does not exist.

- [ ] **Step 4: Create `src/theme/fonts.ts`**

The loader calls are moved VERBATIM from `src/app/layout.tsx` (same variables, weights, preload flags):

```ts
import {
  Archivo,
  Bricolage_Grotesque,
  Cormorant_Garamond,
  Fraunces,
  IBM_Plex_Mono,
  Inter,
  Karla,
  Libre_Caslon_Text,
  Nunito_Sans,
  Public_Sans,
  Sora,
  Space_Grotesk,
} from 'next/font/google';

/*
 * Font config — the single place to add or swap fonts.
 *
 * To add a font for your theme:
 *   1. Import its loader from 'next/font/google' above.
 *   2. Call it below with `variable: '--font-<name>'`, `subsets: ['latin']`,
 *      explicit `weight` if the family is not a variable font, and
 *      `preload: false` unless your DEFAULT theme uses it (preloading
 *      every family costs ~30KB+ of font bytes per page each).
 *   3. Add the const to THEME_FONTS, then point a theme at it in
 *      src/theme/themes.css: `--font-display: var(--font-<name>)`.
 *
 * next/font requires these calls to be static and module-scope — they are
 * compiled away at build time, which is why this file is code, not JSON.
 * src/theme/fonts.test.ts fails the suite if this file and themes.css
 * drift (unloaded reference or unused loader).
 */
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' });
const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cormorant', preload: false });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', preload: false });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', preload: false });
const nunitoSans = Nunito_Sans({ subsets: ['latin'], variable: '--font-nunito-sans', preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', preload: false });
const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo', preload: false });
const caslon = Libre_Caslon_Text({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-caslon', preload: false });
const karla = Karla({ subsets: ['latin'], variable: '--font-karla', preload: false });
const sora = Sora({ subsets: ['latin'], variable: '--font-sora', preload: false });

export const THEME_FONTS = [
  bricolage,
  publicSans,
  plexMono,
  cormorant,
  inter,
  fraunces,
  nunitoSans,
  spaceGrotesk,
  archivo,
  caslon,
  karla,
  sora,
] as const;

// Joined className that exposes every font's CSS variable on <html>.
// Module-scope constant → stable across server render and hydration.
export const fontVariables = THEME_FONTS.map((f) => f.variable).join(' ');
```

- [ ] **Step 5: Refactor `src/app/layout.tsx`**

Delete the `next/font/google` import block (lines 2–15), the loader block and `fontVariables` computation (lines 24–56, including the comment above it). Add the import. The result:

```tsx
import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import { resolveTheme } from '@/theme/registry';
import { themeInitScript } from '@/theme/init-script';
import { fontVariables } from '@/theme/fonts';
import '@/api/client';
import './globals.css';
import '@/theme/themes.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s — ${SITE.name}` },
  description: SITE.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme={resolveTheme(process.env.NEXT_PUBLIC_THEME)}
      // The pre-paint init script may swap data-theme before hydration.
      suppressHydrationWarning
      className={fontVariables}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
      </head>
      <body className="bg-surface font-sans text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Run the sync test to verify it passes**

Run: `npx vitest run src/theme/fonts.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Full suite + behavior-neutrality check**

```bash
npm test
```
Expected: 175 tests pass (171 existing + 4 new), pristine.

```bash
curl -s http://localhost:3005 | grep -c 'font' && curl -s http://localhost:3005 | grep -o 'data-theme="everloom"'
```
Expected: nonzero font references and `data-theme="everloom"` (dev server hot-reloads; if :3005 is down, start `PORT=3005 npm run dev` in the background). Then spot-check one non-default theme's font still applies: open http://localhost:3005, switch to Ninja in the footer, confirm the headline is Sora (or run the e2e: `BASE_URL=http://localhost:3005 npx playwright test e2e/theming.spec.ts` — expect 1 passed).

- [ ] **Step 8: Commit**

```bash
git add src/theme/fonts.ts src/theme/fonts.test.ts src/app/layout.tsx
git commit -m "refactor: fonts.ts single-edit-point font config with themes.css sync test"
```

---

### Task 2: THEMING.md fonts step points at fonts.ts

**Files:**
- Modify: `THEMING.md` (the fonts step — step 3 of "Add your own theme" — plus any other `layout.tsx` font references)

**Interfaces:**
- Consumes: `src/theme/fonts.ts` recipe from Task 1 (documents it).

- [ ] **Step 1: Rewrite the fonts step**

Find the fonts step in THEMING.md (currently says to load families in `src/app/layout.tsx` via `next/font`, with a preload note). Replace its body with:

````markdown
3. **Fonts (optional).** Add your families in `src/theme/fonts.ts` — the
   single font config. Import the loader from `next/font/google`, call it
   with a `--font-<name>` variable (plus explicit `weight` for
   non-variable fonts, and `preload: false` unless your default theme uses
   it), and add it to `THEME_FONTS`. Then map the roles in `themes.css`:

   ```css
   [data-theme='ninja'] {
     --font-display: var(--font-sora);
     --font-sans: var(--font-inter);
   }
   ```

   Skip this and your theme inherits the default typography. Forks that pin
   `NEXT_PUBLIC_THEME` to a non-default theme should flip `preload: true`
   on their theme's families in `src/theme/fonts.ts` (and may remove or
   un-preload the ones they don't use). `npm test` fails if `themes.css`
   references a font `fonts.ts` doesn't load, or a loaded font goes unused.
````

Search THEMING.md for any remaining `layout.tsx` font references and update them to `src/theme/fonts.ts` (mentions of layout.tsx in non-font contexts stay).

- [ ] **Step 2: Verify + full suite**

```bash
grep -n 'fonts.ts' THEMING.md   # expect the new references
grep -n 'layout.tsx' THEMING.md # expect no font-loading references remain
npm test
```
Expected: all pass (docs-only change).

- [ ] **Step 3: Commit**

```bash
git add THEMING.md
git commit -m "docs: fonts step points at src/theme/fonts.ts config"
```

---

### Task 3: Controller QA + merge readiness (controller-executed)

**Files:** none (fix commits only if defects are found).

- [ ] **Step 1:** With the dev stack running, verify per-theme fonts in the browser (switch through 2–3 themes incl. one dark; confirm display font changes: Bricolage → Cormorant/Sora).
- [ ] **Step 2:** Run the e2e theming spec once: `BASE_URL=http://localhost:3005 npx playwright test e2e/theming.spec.ts` — expect 1 passed.
- [ ] **Step 3:** Confirm preload flags survived: `curl -s http://localhost:3005 | grep -o 'rel="preload" as="font"' | wc -l` — expect a small count (~4, the default theme's files), not ~14.

---

## Execution notes

- Task 1 → Task 2 sequential; Task 3 last (controller).
- The dev stack (API :3002, storefront :3005, emulators) is running in cmux panes — reuse it, don't restart services.
