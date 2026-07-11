# Storefront Multi-Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six switchable visual themes for the storefront (CSS-variable based), a footer theme switcher with localStorage persistence and env-var default, and a THEMING.md guide so forkers can add their own theme without touching components.

**Architecture:** All components already style themselves through five color tokens, three font role variables, and `--radius`. We rename the tokens to semantic roles (`surface`/`ink`/`brand`/`highlight`/`subtle`), then add per-theme override blocks keyed on `<html data-theme="…">` in `src/theme/themes.css`. A typed registry drives the switcher UI and validation; an inline pre-paint script prevents theme flash.

**Tech Stack:** Next.js 15 App Router, Tailwind v4 (`@theme`), next/font (Google, self-hosted), Vitest + RTL (jsdom), Playwright.

**Spec:** `/Users/ajaypradeepm/Work/Ecommerce/docs/superpowers/specs/2026-07-11-storefront-theming-design.md` (in the meta repo, one level above this working repo)

## Global Constraints

- Repo: `/Users/ajaypradeepm/Work/Ecommerce/ecommerce-storefront` — do all work on branch `theming` (create from `master` in Task 1 if it doesn't exist; later tasks just check it out).
- Role token names are EXACTLY: `surface`, `ink`, `brand`, `highlight`, `subtle`. Do NOT use `primary`/`accent`/`muted` for brand roles — those names belong to shadcn's `@theme inline` block and collide.
- Theme ids are EXACTLY: `everloom` (default), `noir`, `meadow`, `arcade`, `atelier`, `ninja`.
- localStorage key: `storefront.theme.v1`. Env vars: `NEXT_PUBLIC_THEME`, `NEXT_PUBLIC_SHOW_THEME_SWITCHER` (switcher hidden only when the value is exactly the string `false`).
- Invalid theme values fall back silently to `everloom` — never throw, never log in production paths.
- TypeScript strict; existing suite (122 unit tests, 7 e2e) must stay green after every task.
- Mono font is IBM Plex Mono in ALL themes.
- Test output must be pristine (no stray console warnings).
- Never print `.env` file contents in logs or reports.
- Dev server for this app runs on port 3005 on this machine (`PORT=3005 npm run dev`); e2e needs `BASE_URL=http://localhost:3005`.

## File Structure (end state)

```
src/theme/registry.ts            # ids, labels, swatches, resolveTheme() — single source of truth
src/theme/registry.test.ts
src/theme/themes.css             # one [data-theme='<id>'] block per theme + divider overrides + font role mapping
src/theme/theme-css.test.ts      # registry↔CSS sync + WCAG contrast audit (parses themes.css)
src/theme/init-script.ts         # themeInitScript(): pre-paint localStorage → data-theme
src/theme/init-script.test.ts
src/components/site/ThemeSwitcher.tsx
src/components/site/ThemeSwitcher.test.tsx
src/app/globals.css              # renamed tokens; shadcn vars re-pointed at role tokens
src/app/layout.tsx               # all theme fonts, data-theme default, no-flash script
src/components/site/Footer.tsx   # renders ThemeSwitcher
e2e/theming.spec.ts
THEMING.md
.env.example                     # + NEXT_PUBLIC_THEME, NEXT_PUBLIC_SHOW_THEME_SWITCHER
README.md                        # + Theming section
```

---

### Task 1: Rename color tokens to semantic roles

Pure mechanical rename, no behavior change. Own commit so the diff stays reviewable.

**Files:**
- Modify: `src/app/globals.css` (token names in `@theme`, `.selvedge`, `:focus-visible`)
- Modify: every `src/**/*.ts(x)` file using the old token names in Tailwind classes (≈57 files incl. tests)

**Interfaces:**
- Produces: Tailwind utilities `bg-surface`, `text-ink`, `text-brand`, `text-highlight`, `bg-subtle` (and variants) — all later tasks and all existing components use these.

- [ ] **Step 1: Create the branch**

```bash
cd /Users/ajaypradeepm/Work/Ecommerce/ecommerce-storefront
git checkout master && git checkout -b theming
```

- [ ] **Step 2: Run the scripted rename**

The pattern anchors on a leading `-` so prose like "Organic cotton" in `site.ts` copy is untouched (only class/var usages like `bg-cotton`, `--color-cotton`, `text-indigo/60` match):

```bash
find src -name '*.tsx' -o -name '*.ts' -o -name '*.css' | xargs perl -pi -e \
  's/-cotton\b/-surface/g; s/-indigo\b/-brand/g; s/-madder\b/-highlight/g; s/-flax\b/-subtle/g'
```

- [ ] **Step 3: Verify the sweep**

```bash
grep -rn -- '-cotton\b\|-indigo\b\|-madder\b\|-flax\b' src && echo "LEFTOVERS FOUND" || echo "clean"
grep -n 'Organic cotton' src/lib/site.ts   # copy must be intact (2 occurrences)
git diff --stat | tail -1                  # expect ≈57 files changed
```
Expected: "clean", both copy lines intact. Manually skim `git diff src/app/globals.css` — `@theme` should now define `--color-surface`, `--color-ink`, `--color-brand`, `--color-highlight`, `--color-subtle`; `.selvedge` references `--color-surface`/`--color-highlight`; `:focus-visible` uses `--color-brand`.

- [ ] **Step 4: Run the full suite**

```bash
npm test
```
Expected: 122 tests pass (class-name assertions in tests were renamed by the same sweep), output pristine.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor: rename brand color tokens to semantic roles (surface/ink/brand/highlight/subtle)"
```

---

### Task 2: Theme registry with validation (TDD)

**Files:**
- Create: `src/theme/registry.ts`
- Test: `src/theme/registry.test.ts`

**Interfaces:**
- Produces (used by Tasks 3–7):
  - `THEME_IDS: readonly ['everloom','noir','meadow','arcade','atelier','ninja']`
  - `type ThemeId = (typeof THEME_IDS)[number]`
  - `DEFAULT_THEME: ThemeId` (= `'everloom'`)
  - `THEME_STORAGE_KEY = 'storefront.theme.v1'`
  - `interface ThemeMeta { id: ThemeId; label: string; swatches: { surface: string; brand: string; highlight: string } }`
  - `THEMES: readonly ThemeMeta[]` (all six, in THEME_IDS order)
  - `resolveTheme(value: unknown): ThemeId`

- [ ] **Step 1: Write the failing test**

`src/theme/registry.test.ts`:

```ts
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

  it('exposes the storage key', () => {
    expect(THEME_STORAGE_KEY).toBe('storefront.theme.v1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/theme/registry.test.ts`
Expected: FAIL — cannot resolve `./registry`.

- [ ] **Step 3: Write the implementation**

`src/theme/registry.ts`:

```ts
// Single source of truth for available themes. themes.css must have a
// matching [data-theme='<id>'] block per entry (enforced by theme-css.test.ts).
export const THEME_IDS = [
  'everloom',
  'noir',
  'meadow',
  'arcade',
  'atelier',
  'ninja',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = 'everloom';

export const THEME_STORAGE_KEY = 'storefront.theme.v1';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  swatches: { surface: string; brand: string; highlight: string };
}

export const THEMES: readonly ThemeMeta[] = [
  { id: 'everloom', label: 'Everloom', swatches: { surface: '#faf7f2', brand: '#2f4a7a', highlight: '#a64b35' } },
  { id: 'noir', label: 'Noir', swatches: { surface: '#12100d', brand: '#c9a25f', highlight: '#d1705a' } },
  { id: 'meadow', label: 'Meadow', swatches: { surface: '#f7f5ec', brand: '#3f6b4a', highlight: '#a54a2c' } },
  { id: 'arcade', label: 'Arcade', swatches: { surface: '#f4f4f0', brand: '#2244ff', highlight: '#cc0e63' } },
  { id: 'atelier', label: 'Atelier', swatches: { surface: '#ffffff', brand: '#2b2b2b', highlight: '#c93a24' } },
  { id: 'ninja', label: 'Ninja', swatches: { surface: '#0a0a0a', brand: '#ffd84d', highlight: '#e8be8e' } },
];

export function resolveTheme(value: unknown): ThemeId {
  return typeof value === 'string' &&
    (THEME_IDS as readonly string[]).includes(value)
    ? (value as ThemeId)
    : DEFAULT_THEME;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/theme/registry.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/theme && git commit -m "feat: theme registry with validated resolveTheme"
```

---

### Task 3: Theme CSS blocks, shadcn variable wiring, sync + contrast tests (TDD)

Colors, radius, and divider signatures for all six themes. Fonts come in Task 4.

**Files:**
- Create: `src/theme/themes.css`
- Test: `src/theme/theme-css.test.ts`
- Modify: `src/app/globals.css` (re-point shadcn `:root` vars at role tokens)
- Modify: `src/app/layout.tsx` (import themes.css AFTER globals.css so its `:root`/`[data-theme]` rules win cascade ties)

**Interfaces:**
- Consumes: `THEME_IDS`, `THEMES` from Task 2; renamed tokens from Task 1.
- Produces: `[data-theme='<id>']` blocks each defining `--color-surface`, `--color-ink`, `--color-brand`, `--color-highlight`, `--color-subtle`, `--radius`; per-theme `.selvedge` overrides.

- [ ] **Step 1: Write the failing tests**

`src/theme/theme-css.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEME_IDS, THEMES } from './registry';

const css = readFileSync(new URL('./themes.css', import.meta.url), 'utf8');

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
    // brand on surface — link text (same pair covers surface-on-brand buttons)
    expect(contrast(c('brand'), c('surface'))).toBeGreaterThanOrEqual(4.5);
    // highlight on surface — error/sale text
    expect(contrast(c('highlight'), c('surface'))).toBeGreaterThanOrEqual(4.5);
    // ink on subtle — text on muted panels (footer, badges)
    expect(contrast(c('ink'), c('subtle'))).toBeGreaterThanOrEqual(4.5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/theme/theme-css.test.ts`
Expected: FAIL — `themes.css` does not exist.

- [ ] **Step 3: Create `src/theme/themes.css`**

Note ninja's `highlight` (`#e8be8e`, 11.49:1 on its surface) and every other pair below were pre-computed to pass; do not substitute values without re-checking contrast.

```css
/*
 * Theme definitions. One block per theme id in src/theme/registry.ts —
 * kept in sync by src/theme/theme-css.test.ts, which also enforces
 * WCAG AA contrast on the core pairs.
 *
 * Roles: surface (page bg) · ink (text) · brand (links/CTAs/focus) ·
 * highlight (errors, sale, attention) · subtle (muted bg/borders).
 *
 * This file is imported AFTER globals.css (see src/app/layout.tsx), so its
 * unlayered rules override the @theme defaults for the active data-theme.
 */

[data-theme='everloom'] {
  --color-surface: #faf7f2;
  --color-ink: #23201c;
  --color-brand: #2f4a7a;
  --color-highlight: #a64b35;
  --color-subtle: #e7dfd2;
  --radius: 0.625rem;
}

[data-theme='noir'] {
  --color-surface: #12100d;
  --color-ink: #ece7dd;
  --color-brand: #c9a25f;
  --color-highlight: #d1705a;
  --color-subtle: #282420;
  --radius: 0.25rem;
}

[data-theme='meadow'] {
  --color-surface: #f7f5ec;
  --color-ink: #1e2b20;
  --color-brand: #3f6b4a;
  --color-highlight: #a54a2c;
  --color-subtle: #dde5d4;
  --radius: 1rem;
}

[data-theme='arcade'] {
  --color-surface: #f4f4f0;
  --color-ink: #111111;
  --color-brand: #2244ff;
  --color-highlight: #cc0e63;
  --color-subtle: #e2e2da;
  --radius: 0rem;
}

[data-theme='atelier'] {
  --color-surface: #ffffff;
  --color-ink: #1a1a1a;
  --color-brand: #2b2b2b;
  --color-highlight: #c93a24;
  --color-subtle: #ececec;
  --radius: 0.125rem;
}

[data-theme='ninja'] {
  --color-surface: #0a0a0a;
  --color-ink: #f4f3ef;
  --color-brand: #ffd84d;
  --color-highlight: #e8be8e;
  --color-subtle: #2a2a28;
  --radius: 0.375rem;
}

/* --- Signature divider per theme (everloom's woven stripe is the default
       .selvedge in globals.css) --- */

[data-theme='noir'] .selvedge {
  /* thin double gold hairline */
  height: 7px;
  background: linear-gradient(
    to bottom,
    var(--color-brand) 0 1px,
    transparent 1px 6px,
    var(--color-brand) 6px 7px
  );
}

[data-theme='meadow'] .selvedge {
  /* soft dashed leaf-green band */
  height: 6px;
  background: repeating-linear-gradient(
    90deg,
    var(--color-brand) 0 18px,
    transparent 18px 30px
  );
}

[data-theme='arcade'] .selvedge {
  /* diagonal hazard stripes */
  height: 8px;
  background: repeating-linear-gradient(
    45deg,
    var(--color-ink) 0 14px,
    var(--color-highlight) 14px 28px
  );
}

[data-theme='atelier'] .selvedge {
  /* single hairline */
  height: 1px;
  background: var(--color-ink);
}

[data-theme='ninja'] .selvedge {
  /* dashed yellow blade stripe */
  height: 4px;
  background: repeating-linear-gradient(
    90deg,
    var(--color-brand) 0 24px,
    transparent 24px 36px
  );
}
```

- [ ] **Step 4: Re-point shadcn semantic variables at the role tokens**

In `src/app/globals.css`, replace the entire `:root { ... }` block (the one with oklch zinc values, starting `--radius: 0.625rem;`) with the block below. Leave the `.dark { ... }` block and `@custom-variant dark` untouched (inert but referenced by compiled `dark:` utilities). Leave `@theme` and `@theme inline` blocks as they are after Task 1.

```css
:root {
  --radius: 0.625rem;
  /* shadcn semantic vars follow the active theme's role tokens, so ui
     primitives (dialogs, selects, buttons, inputs) re-theme automatically. */
  --background: var(--color-surface);
  --foreground: var(--color-ink);
  --card: color-mix(in oklab, var(--color-ink) 3%, var(--color-surface));
  --card-foreground: var(--color-ink);
  --popover: color-mix(in oklab, var(--color-ink) 3%, var(--color-surface));
  --popover-foreground: var(--color-ink);
  --primary: var(--color-brand);
  --primary-foreground: var(--color-surface);
  --secondary: var(--color-subtle);
  --secondary-foreground: var(--color-ink);
  --muted: var(--color-subtle);
  --muted-foreground: color-mix(in oklab, var(--color-ink) 65%, var(--color-surface));
  --accent: var(--color-subtle);
  --accent-foreground: var(--color-ink);
  --destructive: var(--color-highlight);
  --border: color-mix(in oklab, var(--color-ink) 15%, var(--color-surface));
  --input: color-mix(in oklab, var(--color-ink) 15%, var(--color-surface));
  --ring: var(--color-brand);
  --chart-1: var(--color-brand);
  --chart-2: var(--color-highlight);
  --chart-3: var(--color-ink);
  --chart-4: var(--color-subtle);
  --chart-5: var(--color-surface);
  --sidebar: var(--color-surface);
  --sidebar-foreground: var(--color-ink);
  --sidebar-primary: var(--color-brand);
  --sidebar-primary-foreground: var(--color-surface);
  --sidebar-accent: var(--color-subtle);
  --sidebar-accent-foreground: var(--color-ink);
  --sidebar-border: color-mix(in oklab, var(--color-ink) 15%, var(--color-surface));
  --sidebar-ring: var(--color-brand);
}
```

- [ ] **Step 5: Import themes.css in the root layout**

In `src/app/layout.tsx`, directly after `import './globals.css';` add:

```ts
import '@/theme/themes.css';
```

(Ordering matters: themes.css must come after globals.css in the bundle so equal-specificity rules win by source order.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/theme/theme-css.test.ts`
Expected: PASS — all sync and contrast assertions.

- [ ] **Step 7: Full suite + visual sanity**

```bash
npm test
```
Expected: all tests pass. If the dev stack is running (`PORT=3005 npm run dev`), spot-check that the everloom look is unchanged (buttons/dialogs may pick up brand indigo instead of the old zinc — that's intended: ui primitives now follow the theme).

- [ ] **Step 8: Commit**

```bash
git add src/theme src/app/globals.css src/app/layout.tsx
git commit -m "feat: six theme CSS blocks with divider signatures, shadcn vars follow theme roles"
```

---

### Task 4: Theme fonts, data-theme bootstrap, and no-flash init script (TDD)

**Files:**
- Create: `src/theme/init-script.ts`
- Test: `src/theme/init-script.test.ts`
- Modify: `src/app/layout.tsx` (font loading, `data-theme`, inline script)
- Modify: `src/app/globals.css` (move font tokens into `@theme inline`)
- Modify: `src/theme/themes.css` (font role mapping per theme)

**Interfaces:**
- Consumes: `THEME_IDS`, `THEME_STORAGE_KEY`, `resolveTheme` from Task 2.
- Produces: `themeInitScript(): string` (used in layout only); per-family CSS variables `--font-bricolage`, `--font-public-sans`, `--font-plex-mono`, `--font-cormorant`, `--font-inter`, `--font-fraunces`, `--font-nunito-sans`, `--font-space-grotesk`, `--font-archivo`, `--font-caslon`, `--font-karla`, `--font-sora`.

- [ ] **Step 1: Write the failing test**

`src/theme/init-script.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/theme/init-script.test.ts`
Expected: FAIL — cannot resolve `./init-script`.

- [ ] **Step 3: Implement `src/theme/init-script.ts`**

```ts
import { THEME_IDS, THEME_STORAGE_KEY } from './registry';

// Inlined into <body> before hydration so a stored theme applies pre-paint
// (no flash of the default theme). Must stay dependency-free and ES5-safe.
export function themeInitScript(): string {
  const ids = JSON.stringify(THEME_IDS);
  const key = JSON.stringify(THEME_STORAGE_KEY);
  return `(function(){try{var t=localStorage.getItem(${key});if(t&&${ids}.indexOf(t)!==-1){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/theme/init-script.test.ts`
Expected: PASS.

- [ ] **Step 5: Move font tokens to `@theme inline`**

In `src/app/globals.css`, delete these three lines from the plain `@theme { ... }` block:

```css
  --font-display: var(--font-display);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
```

and add them (identical text) to the existing `@theme inline { ... }` block instead. (Plain `@theme` emits a circular `:root` definition; `inline` makes the utilities reference `var(--font-display)` directly, which themes.css now defines.)

- [ ] **Step 6: Add font role mapping to `src/theme/themes.css`**

Append:

```css
/* --- Font roles. Family variables (--font-sora etc.) are provided by
       next/font in src/app/layout.tsx. Mono is IBM Plex Mono everywhere. --- */

:root {
  --font-display: var(--font-bricolage);
  --font-sans: var(--font-public-sans);
  --font-mono: var(--font-plex-mono);
}

[data-theme='noir'] {
  --font-display: var(--font-cormorant);
  --font-sans: var(--font-inter);
}

[data-theme='meadow'] {
  --font-display: var(--font-fraunces);
  --font-sans: var(--font-nunito-sans);
}

[data-theme='arcade'] {
  --font-display: var(--font-space-grotesk);
  --font-sans: var(--font-archivo);
}

[data-theme='atelier'] {
  --font-display: var(--font-caslon);
  --font-sans: var(--font-karla);
}

[data-theme='ninja'] {
  --font-display: var(--font-sora);
  --font-sans: var(--font-inter);
}
```

Note: append these as separate blocks exactly as shown. The sync test's regex matches the FIRST `[data-theme='<id>'] {` block per id, which remains the color block from Task 3 as long as these font blocks come after it in the file.

- [ ] **Step 7: Rewrite `src/app/layout.tsx`**

Replace the file with:

```tsx
import type { Metadata } from 'next';
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
import { SITE } from '@/lib/site';
import { resolveTheme } from '@/theme/registry';
import { themeInitScript } from '@/theme/init-script';
import '@/api/client';
import './globals.css';
import '@/theme/themes.css';
import { Providers } from './providers';

// One font per theme role per theme (see src/theme/themes.css). next/font
// self-hosts and subsets these at build time; unused families cost nothing
// at runtime beyond their @font-face declarations.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' });
const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cormorant' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces' });
const nunitoSans = Nunito_Sans({ subsets: ['latin'], variable: '--font-nunito-sans' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo' });
const caslon = Libre_Caslon_Text({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-caslon' });
const karla = Karla({ subsets: ['latin'], variable: '--font-karla' });
const sora = Sora({ subsets: ['latin'], variable: '--font-sora' });

const fontVariables = [
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
]
  .map((f) => f.variable)
  .join(' ');

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
      <body className="bg-surface font-sans text-ink antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Full suite + dev-server check**

```bash
npm test
```
Expected: all pass. Then confirm the app boots and renders with the everloom fonts (dev stack on 3005):

```bash
curl -s http://localhost:3005 | grep -o "data-theme=\"everloom\"" | head -1
```
Expected: `data-theme="everloom"` (start `PORT=3005 npm run dev` first if not running).

- [ ] **Step 9: Commit**

```bash
git add src/theme src/app/layout.tsx src/app/globals.css
git commit -m "feat: per-theme fonts, data-theme SSR default, pre-paint theme init script"
```

---

### Task 5: ThemeSwitcher component in the footer (TDD)

**Files:**
- Create: `src/components/site/ThemeSwitcher.tsx`
- Test: `src/components/site/ThemeSwitcher.test.tsx`
- Modify: `src/components/site/Footer.tsx` (render switcher in the contact-email row)

**Interfaces:**
- Consumes: `THEMES`, `THEME_STORAGE_KEY`, `resolveTheme`, `ThemeId` from Task 2.
- Produces: `<ThemeSwitcher />` (no props).

- [ ] **Step 1: Write the failing tests**

`src/components/site/ThemeSwitcher.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEMES, THEME_STORAGE_KEY } from '@/theme/registry';
import { ThemeSwitcher } from './ThemeSwitcher';

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.setAttribute('data-theme', 'everloom');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders one labeled button per theme', () => {
    render(<ThemeSwitcher />);
    for (const t of THEMES) {
      expect(
        screen.getByRole('button', { name: `Switch to ${t.label} theme` }),
      ).toBeInTheDocument();
    }
  });

  it('marks the current theme as pressed', () => {
    render(<ThemeSwitcher />);
    expect(
      screen.getByRole('button', { name: 'Switch to Everloom theme' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies and persists a theme on click', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await user.click(
      screen.getByRole('button', { name: 'Switch to Ninja theme' }),
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('ninja');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('ninja');
    expect(
      screen.getByRole('button', { name: 'Switch to Ninja theme' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders nothing when NEXT_PUBLIC_SHOW_THEME_SWITCHER=false', () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_THEME_SWITCHER', 'false');
    const { container } = render(<ThemeSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/site/ThemeSwitcher.test.tsx`
Expected: FAIL — cannot resolve `./ThemeSwitcher`.

- [ ] **Step 3: Implement `src/components/site/ThemeSwitcher.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  THEMES,
  THEME_STORAGE_KEY,
  resolveTheme,
  type ThemeId,
} from '@/theme/registry';

// Live theme preview for the showcase deployment. Real stores hide it with
// NEXT_PUBLIC_SHOW_THEME_SWITCHER=false (see THEMING.md).
export function ThemeSwitcher() {
  // null until mounted — SSR doesn't know the visitor's stored theme.
  const [active, setActive] = useState<ThemeId | null>(null);

  useEffect(() => {
    setActive(resolveTheme(document.documentElement.getAttribute('data-theme')));
  }, []);

  if (process.env.NEXT_PUBLIC_SHOW_THEME_SWITCHER === 'false') return null;

  const apply = (id: ThemeId) => {
    document.documentElement.setAttribute('data-theme', id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // Private mode: attribute-only switch still works for the session.
    }
    setActive(id);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs tracking-wide text-ink/60 uppercase">
        Theme
      </span>
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-label={`Switch to ${t.label} theme`}
          aria-pressed={active === t.id}
          title={t.label}
          onClick={() => apply(t.id)}
          className={`size-5 rounded-full border border-ink/30 transition-shadow ${
            active === t.id ? 'ring-2 ring-brand ring-offset-1' : 'hover:ring-1 hover:ring-ink/40'
          }`}
          style={{
            background: `conic-gradient(${t.swatches.surface} 0 50%, ${t.swatches.brand} 50% 80%, ${t.swatches.highlight} 80% 100%)`,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/site/ThemeSwitcher.test.tsx`
Expected: PASS (5 tests). The `aria-pressed` initial-state test passes because the `useEffect` runs before assertions in RTL's `render`.

- [ ] **Step 5: Render it in the footer**

In `src/components/site/Footer.tsx`, import it and change the contact-email row to a flex row (keep the mailto link exactly as is; class names shown post-rename):

```tsx
import { ThemeSwitcher } from './ThemeSwitcher';
```

```tsx
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 pb-8 text-sm sm:px-6">
        <a href={`mailto:${SITE.contactEmail}`} className="text-ink hover:text-brand">
          {SITE.contactEmail}
        </a>
        <ThemeSwitcher />
      </div>
```

- [ ] **Step 6: Full suite**

```bash
npm test
```
Expected: all pass (existing Footer-related tests unaffected — the mailto link and structure are preserved).

- [ ] **Step 7: Commit**

```bash
git add src/components/site/ThemeSwitcher.tsx src/components/site/ThemeSwitcher.test.tsx src/components/site/Footer.tsx
git commit -m "feat: footer theme switcher with persistence and env kill-switch"
```

---

### Task 6: Playwright e2e — switch, computed style, persistence

**Files:**
- Create: `e2e/theming.spec.ts`

**Interfaces:**
- Consumes: the running stack (API :3002, `PORT=3005 npm run dev`) and the footer switcher from Task 5.

- [ ] **Step 1: Write the test**

`e2e/theming.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

// Fresh context per test = clean localStorage; no cross-test theme leakage.
test('theme switcher applies, restyles, and persists across reload', async ({
  page,
}) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'everloom');

  const before = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );

  await page
    .getByRole('button', { name: 'Switch to Ninja theme' })
    .click();

  await expect(html).toHaveAttribute('data-theme', 'ninja');
  const after = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  expect(after).not.toBe(before);
  // ninja surface is #0a0a0a
  expect(after).toBe('rgb(10, 10, 10)');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'ninja');
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe('rgb(10, 10, 10)');
});
```

- [ ] **Step 2: Run it against the live stack**

The stack must be running (Postgres, API :3002 seeded, auth emulator :9098, storefront dev server). Start the storefront if needed: `PORT=3005 npm run dev` (background). Then:

```bash
BASE_URL=http://localhost:3005 npx playwright test e2e/theming.spec.ts
```
Expected: 1 passed. If the switcher button isn't found, the footer is below the fold — Playwright's actionability auto-scrolls, so a failure here is real, not a scroll issue.

- [ ] **Step 3: Run the whole e2e suite once**

```bash
BASE_URL=http://localhost:3005 npm run e2e
```
Expected: 8 passed (7 existing + 1 new).

- [ ] **Step 4: Commit**

```bash
git add e2e/theming.spec.ts
git commit -m "test: e2e coverage for theme switching and persistence"
```

---

### Task 7: THEMING.md, README section, .env.example

**Files:**
- Create: `THEMING.md`
- Modify: `README.md` (add a "Theming" section after the existing setup/overview sections; match the README's existing heading style)
- Modify: `.env.example` (append two vars)

**Interfaces:**
- Consumes: everything shipped in Tasks 1–6 (documents it).

- [ ] **Step 1: Append to `.env.example`**

```bash
# Theming (see THEMING.md). Valid: everloom | noir | meadow | arcade | atelier | ninja
NEXT_PUBLIC_THEME=
# Set to false to hide the live theme switcher in the footer (real stores)
NEXT_PUBLIC_SHOW_THEME_SWITCHER=
```

- [ ] **Step 2: Write `THEMING.md`**

````markdown
# Theming

This storefront is a generic, forkable ecommerce product. Every component
styles itself through five semantic color roles, three font roles, and a
radius token — so a complete rebrand is a CSS block plus a registry entry.
No component changes.

## Quick start

```bash
# Pick a built-in theme as the default:
NEXT_PUBLIC_THEME=ninja

# Hide the footer theme switcher for a real store:
NEXT_PUBLIC_SHOW_THEME_SWITCHER=false
```

Your brand name, tagline, and copy live separately in `src/lib/site.ts` —
set them once, then use any theme.

## Built-in themes

| id | Vibe |
|---|---|
| `everloom` (default) | Warm organic-cotton editorial |
| `noir` | Dark luxury — serif, gold on near-black |
| `meadow` | Organic wellness — moss green, rounded |
| `arcade` | Bold streetwear — electric blue, hot pink, zero radius |
| `atelier` | Gallery minimal — monochrome, hairline rules |
| `ninja` | Dark tech — yellow on black (homage to localninja.ca) |

Visitors can preview all of them live via the footer switcher; the choice
persists in `localStorage` (`storefront.theme.v1`). Resolution order:
localStorage (if valid) → `NEXT_PUBLIC_THEME` (if valid) → `everloom`.
Invalid values fall back silently, so removing a theme can't break the site.

## The five color roles

| Role | Used for |
|---|---|
| `surface` | Page background |
| `ink` | Body text |
| `brand` | Links, CTAs, focus rings |
| `highlight` | Errors, sale flashes, attention |
| `subtle` | Muted panels, borders, badges |

Components use them as Tailwind utilities (`bg-surface`, `text-ink`,
`text-brand`, `bg-subtle`, …). The shadcn ui primitives (dialogs, selects,
buttons) are wired to the same roles via `src/app/globals.css`, so they
re-theme automatically.

## Add your own theme (worked example: how `ninja` was built)

1. **Define the CSS block** in `src/theme/themes.css`:

   ```css
   [data-theme='ninja'] {
     --color-surface: #0a0a0a;
     --color-ink: #f4f3ef;
     --color-brand: #ffd84d;
     --color-highlight: #e8be8e;
     --color-subtle: #2a2a28;
     --radius: 0.375rem;
   }
   ```

2. **Register it** in `src/theme/registry.ts` — add `'ninja'` to `THEME_IDS`
   and an entry to `THEMES` (label + surface/brand/highlight swatches for the
   switcher). TypeScript and the sync test enforce that both stay aligned.

3. **Fonts (optional).** Load families in `src/app/layout.tsx` via
   `next/font` with a `--font-<family>` variable, then map the roles in
   `themes.css`:

   ```css
   [data-theme='ninja'] {
     --font-display: var(--font-sora);
     --font-sans: var(--font-inter);
   }
   ```

   Skip this and your theme inherits the default typography.

4. **Signature divider (optional).** Override `.selvedge` for your theme:

   ```css
   [data-theme='ninja'] .selvedge {
     height: 4px;
     background: repeating-linear-gradient(
       90deg,
       var(--color-brand) 0 24px,
       transparent 24px 36px
     );
   }
   ```

5. **Check contrast.** Run `npm test` — `src/theme/theme-css.test.ts`
   computes WCAG AA ratios for every theme and fails if `ink`/`brand`/
   `highlight` don't reach 4.5:1 on `surface` (or `ink` on `subtle`).
   Dark themes: also eyeball product-image cards and focus rings.

That's it — the switcher, persistence, and SSR default pick up the new
theme from the registry automatically.

## Removing themes for production

Delete the CSS block, the registry entry, and (if unused elsewhere) the
font loads. Set `NEXT_PUBLIC_THEME` to your theme and
`NEXT_PUBLIC_SHOW_THEME_SWITCHER=false`.
````

- [ ] **Step 3: Add a README section**

In `README.md`, add (adjusting heading level to match the file):

```markdown
## Theming

Six built-in themes (everloom, noir, meadow, arcade, atelier, ninja) are
switchable live from the footer. Set the default with `NEXT_PUBLIC_THEME`,
hide the switcher with `NEXT_PUBLIC_SHOW_THEME_SWITCHER=false`, or add your
own theme with one CSS block + one registry entry — see [THEMING.md](./THEMING.md).
```

- [ ] **Step 4: Verify docs build nothing is broken**

```bash
npm test
```
Expected: all pass (docs-only task; suite is the regression gate).

- [ ] **Step 5: Commit**

```bash
git add THEMING.md README.md .env.example
git commit -m "docs: THEMING.md forker guide, README theming section, env examples"
```

---

### Task 8: Browser QA across all six themes (controller-executed)

**This task is executed by the controller via cmux browser automation, not a subagent.** The full stack must be running (db, emulators, API :3002, storefront :3005).

**Files:** none (fix commits only if defects are found).

- [ ] **Step 1: For each theme (everloom, noir, meadow, arcade, atelier, ninja), via the footer switcher:**
  - Home: hero, USP strip, selvedge divider renders with the theme's signature, footer marquee legible
  - /products: cards, filters/sort controls, pagination legible
  - Product detail: gallery, buy column, accordions, reviews
  - /cart with an item: line rows, qty stepper, summary, checkout button
  - /login: auth form, error state (submit bad credentials → highlight-colored error text legible)
- [ ] **Step 2: Dark-theme specifics (noir, ninja):** product images on subtle-colored card backgrounds, focus-visible ring visible on dark surface (Tab through header), dialog/select surfaces (account → address dialog) not stuck light
- [ ] **Step 3: Persistence:** pick ninja, reload — no flash of everloom before ninja paints (watch the load)
- [ ] **Step 4: File defects as fix commits on the branch** (systematic-debugging for anything non-obvious), re-run `npm test` after fixes
- [ ] **Step 5: Final full check**

```bash
npm test && BASE_URL=http://localhost:3005 npm run e2e
```
Expected: all unit + 8 e2e green.

---

## Execution notes

- Tasks 1→5 are strictly sequential (each builds on the previous). Task 6 needs 5; Task 7 can run after 5 (documents 1–6); Task 8 last.
- The dev stack (Postgres, emulators, API on :3002) from the Phase 2/3 sessions may still be running in cmux panes — reuse it; only the storefront dev server (`PORT=3005 npm run dev`) typically needs starting.
- After merge: sync the GitHub mirror per memory_about_project.md if asked.
