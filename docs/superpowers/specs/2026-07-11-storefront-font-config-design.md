# Storefront Font Config — Design

**Date:** 2026-07-11
**Repo:** `ecommerce-storefront`
**Status:** Approved
**Builds on:** `2026-07-11-storefront-theming-design.md`

## Goal

Fonts should be editable the way themes are: one obvious config file a forker
edits, guarded by a sync test — no digging through `layout.tsx`.

## Background & constraint

Today the 12 `next/font/google` loader calls live in `src/app/layout.tsx`;
each theme's font choice is a CSS-variable mapping in `src/theme/themes.css`
(`--font-display: var(--font-sora)` etc.). `next/font` loaders are a
compile-time transform: calls must be static, literal, and module-scope, so a
data-driven config cannot drive them. The config file therefore contains the
loader calls themselves.

## Design

### `src/theme/fonts.ts` — the single font edit point

- All 12 `next/font/google` imports and loader calls move verbatim from
  `layout.tsx` (same `--font-<family>` variable names, same weights, same
  `preload` flags: only the default theme's three families preload).
- Exports:
  - `THEME_FONTS` — readonly array of the loader results
  - `fontVariables: string` — the joined `.variable` className string
    (module-scope constant, keeps hydration stable)
- Header comment documents the forker recipe:
  1. import the loader from `next/font/google`
  2. call it with `variable: '--font-<name>'`, `subsets: ['latin']`, explicit
     weights if the family isn't a variable font, and `preload: false` unless
     your default theme uses it
  3. add the result to `THEME_FONTS`, then reference `var(--font-<name>)` in
     a theme block in `themes.css`
- `src/app/layout.tsx` deletes its loader block and imports
  `{ fontVariables }` from `@/theme/fonts`. No other change; rendering is
  byte-identical.

### Sync test — `src/theme/fonts.test.ts`

Parses **source text** of both files (must NOT import `fonts.ts`: loaders
only run under Next's compiler, and the runtime `.variable` is a hashed class
name, not the CSS custom-property name):

- Extract every `var(--font-…)` referenced in `themes.css`.
- Extract every `variable: '--font-…'` declared in `fonts.ts`.
- **Fail** if the CSS references a font variable `fonts.ts` doesn't declare
  (forker edited CSS, forgot the loader — today this silently falls back).
- **Fail** if `fonts.ts` declares a font no theme references (dead loader —
  message says to delete it). Exception: none; the set must match exactly.
- Sanity: the number of `variable:` declarations equals `THEME_FONTS.length`
  — verified by regex-counting entries in the `THEME_FONTS` array literal in
  source, not by importing.

### Docs

`THEMING.md` step 3 (fonts) rewritten: edit `src/theme/fonts.ts` (with the
recipe above), not `layout.tsx`; preload guidance moves with it.

## Error handling

- No runtime surface: a bad loader call fails `next build`/dev loudly; config
  ↔ CSS drift fails the unit suite via the sync test.

## Testing

- New sync test passes on the current file pair; full suite (171 unit) stays
  green; e2e untouched (behavior-neutral refactor).
- Manual check: dev server still serves each theme's display font (spot-check
  one theme in the browser).

## Out of scope

- Runtime/dynamic font loading (Google Fonts `<link>`).
- Changing any actual font choices or the per-theme CSS mapping mechanism.
- Admin SPA.
