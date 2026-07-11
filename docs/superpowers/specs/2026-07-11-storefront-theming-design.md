# Storefront Multi-Theme System — Design

**Date:** 2026-07-11
**Repo:** `ecommerce-storefront`
**Status:** Approved

## Goal

The storefront is a generic, forkable ecommerce product. Anyone forking the repo
should be able to pick a visual theme (or build their own) without touching
components. Ship six built-in themes with a live switcher so the repo demos the
capability out of the box.

## Background

All storefront components style themselves through five brand color tokens
(currently named `cotton`/`ink`/`indigo`/`madder`/`flax`), three font role
variables (`--font-display`/`--font-sans`/`--font-mono`), a `--radius` scale,
and one signature divider class (`.selvedge`). Brand copy lives solely in
`src/lib/site.ts`. This makes themes achievable as pure CSS variable overrides.

## Architecture: CSS variable overrides on `data-theme`

- `<html data-theme="<id>">` selects the active theme.
- Each theme is a CSS block in **`src/theme/themes.css`**:
  `[data-theme='ninja'] { --color-surface: #0a0a0a; ... }` overriding the five
  color tokens, the three font role variables, `--radius`, and the signature
  divider treatment. The default theme's values live in `:root` (Everloom).
- Tailwind v4 utilities (`bg-surface`, `text-ink`, …) already resolve through
  these variables, so **no component changes** are needed for theming.
- **`src/theme/registry.ts`** is the typed source of truth:
  `THEMES: { id, label, swatches: { surface, primary, accent } }[]`, plus
  `resolveTheme(value: unknown): ThemeId` (falls back to `everloom` for any
  invalid/unknown value). Used by the switcher UI and env-var validation.
- **`src/app/layout.tsx`** loads all theme fonts via `next/font` (self-hosted,
  latin subset), exposes each as a CSS variable (e.g. `--font-sora`), renders
  `data-theme` from the env default, and includes a tiny inline no-flash script.

### Token rename (prerequisite, own commit)

Rename the color tokens to semantic roles across the codebase (≈57 files
incl. tests), mechanical find/replace, verified by the full test suite:

| Old | New |
|---|---|
| `cotton` | `surface` |
| `ink` | `ink` (unchanged) |
| `indigo` | `primary` |
| `madder` | `accent` |
| `flax` | `muted` |

Applies to Tailwind class usages (`bg-cotton` → `bg-surface`), the `@theme`
token names in `globals.css`, and the `.selvedge` gradient references.

## The six themes

Hex values are targets; the contrast audit (below) may fine-tune them.

| Theme | surface | ink | primary | accent | muted | Display / Body | Radius | Divider signature |
|---|---|---|---|---|---|---|---|---|
| **everloom** (default) | `#faf7f2` | `#23201c` | `#2f4a7a` | `#a64b35` | `#e7dfd2` | Bricolage Grotesque / Public Sans | 0.625rem | woven selvedge stripe (unchanged) |
| **noir** — dark luxury | `#12100d` | `#ece7dd` | `#c9a25f` gold | `#8c3b2e` oxblood | `#282420` | Cormorant Garamond / Inter | 0.25rem | thin double gold hairline |
| **meadow** — organic wellness | `#f7f5ec` | `#1e2b20` | `#3f6b4a` moss | `#c26d4b` terracotta | `#dde5d4` | Fraunces / Nunito Sans | 1rem | soft dashed leaf-green band |
| **arcade** — streetwear | `#f4f4f0` | `#111111` | `#2244ff` | `#ff2e88` | `#e2e2da` | Space Grotesk / Archivo | 0 | diagonal hazard stripes (ink/pink) |
| **atelier** — gallery minimal | `#ffffff` | `#1a1a1a` | `#2b2b2b` | `#d4442e` (sparse) | `#ececec` | Libre Caslon Text / Karla | 0.125rem | single 1px ink hairline |
| **ninja** — localninja.ca homage | `#0a0a0a` | `#f4f3ef` | `#ffd84d` yellow | `#e8be8e` tan | `#2a2a28` | Sora / Inter | 0.375rem | dashed yellow "blade" stripe |

- Mono font stays **IBM Plex Mono** in all themes (prices, order IDs).
- The divider stays one class (`.selvedge`) whose appearance is driven by
  per-theme variables / `[data-theme]` overrides in `themes.css`.
- A theme is **fixed** — no light/dark auto-switching within a theme.

### Contrast audit (explicit task)

For every theme, verify WCAG AA for the key pairs: ink-on-surface,
primary-on-surface (link text), surface-on-primary (button text — note
components render button text with `text-surface`, which self-corrects on dark
themes), accent usages, muted-on-surface borders/badges, and `:focus-visible`
ring visibility. Adjust hex values where a pair fails. Dark themes (noir,
ninja) additionally get a visual pass over light-surface assumptions (image
cards on `muted`, skeleton loaders, shadows).

## Theme selection & persistence

Resolution order (highest wins):

1. `localStorage['storefront.theme.v1']` — set by the live switcher, if valid
2. `NEXT_PUBLIC_THEME` — build-time default, if valid
3. `everloom`

Invalid values fall through silently (a fork that removes a theme can't break
the site). A small inline `<script>` in `<head>` applies the localStorage
override to `document.documentElement` **before first paint** (no flash);
`suppressHydrationWarning` on `<html>` covers the attribute swap. SSR always
renders the env default.

## ThemeSwitcher (footer)

- Compact row in the footer: "Theme" label + six swatch buttons (small circles
  showing each theme's surface/primary/accent), active theme ring-marked,
  `aria-label` per theme; plain buttons → keyboard accessible.
- Click → sets `data-theme` + writes localStorage.
- Hidden entirely when `NEXT_PUBLIC_SHOW_THEME_SWITCHER=false`
  (default: shown — this repo is a showcase).

## Forker config surface (documented in `THEMING.md`)

1. `NEXT_PUBLIC_THEME=<id>` — pick the default theme.
2. `NEXT_PUBLIC_SHOW_THEME_SWITCHER=false` — hide the picker for a real store.
3. **Add your own theme:** one CSS block in `src/theme/themes.css` + one
   registry entry + (optional) font loading in `layout.tsx`. `THEMING.md`
   walks through this using the ninja theme as the worked example, and
   documents the five color roles and the contrast pairs to check.
4. Brand name/tagline/copy: `src/lib/site.ts` (unchanged, separate concern —
   themes are visuals only).

## Error handling

- Unknown/invalid theme id from env or localStorage → silent fallback per the
  resolution order; no console noise in production.
- localStorage unavailable (private mode) → switcher still works for the
  session (attribute only); write failures swallowed.

## Testing

- **Unit:** `resolveTheme` validation + resolution order; ThemeSwitcher RTL
  tests (renders all registry themes, click sets attribute + localStorage,
  hidden when env flag false); a registry↔CSS sync test asserting every
  registry id has a `[data-theme='<id>']` block in `themes.css`.
- **Regression:** full existing suite (122 unit + 7 e2e) green after the token
  rename and after theming lands.
- **E2E (Playwright):** switch theme via the footer picker; assert `data-theme`
  attribute and a computed background-color change; assert persistence across
  a reload.
- **Manual QA:** browser pass over key pages (home, listing, PDP, cart,
  account/orders) in all six themes, focusing on the dark themes.

## Out of scope

- Admin SPA theming (internal tool, stays as-is).
- Per-user theme stored in accounts.
- Light/dark variants within a theme.
- Runtime custom theme editor.
