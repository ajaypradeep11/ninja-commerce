# Storefront wide-screen layout (Casetify-style widths)

**Date:** 2026-07-19
**Scope:** `ecommerce-storefront` only. Layout classes only — no behavior, API, or theme changes.

## Goal

On large monitors the storefront boxes everything at `max-w-6xl` (1152px), leaving big dead
margins. Casetify — the reference the user pointed at — runs its commerce surfaces at a
~1600px content width with generous side padding, while keeping reading/form surfaces narrow.
Adopt that width language without changing the current branding or the two-column hero
structure.

Reference measurements (casetify.com at a 1728px viewport): main content containers max out
around 1641px / 1376px; hero is full-bleed (explicitly **not** adopted — user chose to keep
the current two-column hero, just wider); product/news grids run 4–5 columns.

## Design

### 1. Shared width token

Add a `container-wide` utility class in `ecommerce-storefront/src/app/globals.css`:

- `max-width: 100rem` (1600px)
- `margin-inline: auto`
- responsive padding equivalent to `px-4 sm:px-6 lg:px-10`

One class, defined once, so the width can be tuned later in one place. Below ~1200px
viewports nothing changes visually.

### 2. Surfaces that go wide (swap `max-w-6xl` + padding classes → `container-wide`)

- `components/site/Header.tsx`
- `components/site/Footer.tsx` (all four `max-w-6xl` rows)
- `components/site/UspStrip.tsx`
- `app/(store)/page.tsx` — hero section (keeps two-column grid; collage images get a larger
  size step at `lg`), category tiles, New Arrivals island
- `app/(store)/loading.tsx` — mirror the home page
- `app/(store)/products/page.tsx` + `products/loading.tsx` — grid gains a column step:
  `grid-cols-2 → md:grid-cols-4 → xl:grid-cols-5` so cards don't balloon at 1600px
- `app/(store)/products/[slug]/page.tsx` + its `loading.tsx`
- `components/site/RelatedProducts.tsx` — also 5-up at `xl`

`ProductCard`'s `sizes` attr updates to account for the 5-column step (`~20vw` at `xl`).

### 3. Surfaces that stay narrow (unchanged, on purpose)

Account layout (`max-w-3xl`), cart (`max-w-4xl`), auth forms, checkout success,
`StaticPageHeader` static pages, error/not-found pages. These are reading/form surfaces;
Casetify keeps the equivalents narrow too.

## Testing / verification

- `npm test` (vitest) in `ecommerce-storefront` — expected unaffected.
- Visual check in a 1728px-wide browser: home, products list, product detail, cart, footer.
  Confirm wide surfaces fill to ~1600px, narrow surfaces unchanged, and nothing regresses at
  ~1280px and mobile widths.

## Out of scope

Full-bleed hero/carousel, centered-logo header, bento collection tiles, admin app, any
copy/theme changes.
