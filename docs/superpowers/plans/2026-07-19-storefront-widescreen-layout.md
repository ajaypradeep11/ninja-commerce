# Storefront Wide-Screen Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen the storefront's commerce surfaces from 1152px (`max-w-6xl`) to a Casetify-style 1600px container, via one shared `container-wide` CSS class.

**Architecture:** A single `.container-wide` class in `globals.css` (max-width 100rem + auto margins + responsive padding) replaces `mx-auto max-w-6xl px-4 sm:px-6` on wide surfaces. Product grids gain an `xl:grid-cols-5` step so cards don't balloon. Reading/form surfaces (account, cart, auth, checkout success, static pages) intentionally keep their current narrow widths.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4 (custom classes live as plain CSS in `globals.css`, same as `.selvedge`), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-19-storefront-widescreen-layout-design.md`

## Global Constraints

- Layout classes only — no behavior, API, copy, or theme changes.
- Wide token is exactly: `max-width: 100rem`, auto inline margins, padding `1rem` / `1.5rem` @640px / `2.5rem` @1024px.
- Do NOT touch: account layout, cart, auth forms, checkout success, `StaticPageHeader`, error/not-found pages, admin app.
- All file paths below are relative to `ecommerce-storefront/`.
- The working tree starts with pre-existing WIP (footer trust band, rounded corners, orders-page island). Task 0 commits it separately BEFORE any layout work; layout commits must not mix with it.
- This is pure presentation with no unit-testable logic; TDD is satisfied by keeping the existing vitest suite green per task plus a final visual verification.

---

### Task 0: Commit pre-existing WIP separately

**Files:**
- No edits. Commits: `src/app/(store)/account/orders/page.tsx`, `src/app/(store)/page.tsx`, `src/components/site/Footer.tsx`, `src/components/site/ProductCard.tsx`, `src/components/site/PaymentBadges.tsx` (untracked).

**Interfaces:**
- Produces: a clean working tree so later tasks' commits contain only layout changes.

- [ ] **Step 1: Verify the WIP passes tests and lint**

Run (from `ecommerce-storefront/`): `npm test && npm run lint`
Expected: vitest suite PASS, oxlint clean. If either fails, STOP and report — do not commit broken WIP.

- [ ] **Step 2: Commit the WIP as its own commit**

```bash
cd ecommerce-storefront
git add src/app/\(store\)/account/orders/page.tsx src/app/\(store\)/page.tsx \
  src/components/site/Footer.tsx src/components/site/ProductCard.tsx \
  src/components/site/PaymentBadges.tsx
git commit -m "Storefront: footer trust band (payment badges + guarantee), rounded corners, orders light island"
```

Then `git status` — expected: working tree clean (no storefront files modified).

---

### Task 1: `container-wide` class + widen Header, Footer, UspStrip

**Files:**
- Modify: `src/app/globals.css` (after the `.selvedge` block, ~line 25)
- Modify: `src/components/site/Header.tsx:17`
- Modify: `src/components/site/UspStrip.tsx:12`
- Modify: `src/components/site/Footer.tsx` (four container rows)

**Interfaces:**
- Produces: `.container-wide` CSS class — every later task swaps `mx-auto max-w-6xl px-4 sm:px-6` for it. Vertical padding (`py-*`) always stays on the element as a Tailwind class.

- [ ] **Step 1: Add the class to `globals.css`**

Insert directly after the closing brace of `.selvedge`:

```css
/* Wide commerce container (Casetify-style): catalog/chrome surfaces span
   up to 1600px; reading and form surfaces keep their own narrower widths. */
.container-wide {
  max-width: 100rem;
  margin-inline: auto;
  padding-inline: 1rem;
}
@media (min-width: 640px) {
  .container-wide {
    padding-inline: 1.5rem;
  }
}
@media (min-width: 1024px) {
  .container-wide {
    padding-inline: 2.5rem;
  }
}
```

- [ ] **Step 2: Widen Header**

In `src/components/site/Header.tsx`:

```
- <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4 sm:px-6">
+ <div className="container-wide flex items-center gap-6 py-4">
```

- [ ] **Step 3: Widen UspStrip**

In `src/components/site/UspStrip.tsx`:

```
- <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 text-sm sm:grid-cols-3 sm:px-6">
+ <ul className="container-wide grid grid-cols-1 gap-6 py-8 text-sm sm:grid-cols-3">
```

- [ ] **Step 4: Widen Footer (all four rows)**

In `src/components/site/Footer.tsx` (post-WIP-commit state), make these four swaps:

```
- <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:grid-cols-2 sm:px-6">
+ <div className="container-wide grid gap-8 py-8 sm:grid-cols-2">
```

```
- <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 border-t border-ink/10 px-4 py-10 sm:grid-cols-3 sm:px-6">
+ <div className="container-wide grid grid-cols-2 gap-8 border-t border-ink/10 py-10 sm:grid-cols-3">
```

Note for this one: `border-t` was on the outer wrapper div in the pre-WIP file but is on this row now — keep it exactly where the current file has it.

```
- <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 pb-8 text-sm sm:px-6">
+ <div className="container-wide flex flex-wrap items-center justify-between gap-4 pb-8 text-sm">
```

```
- <p className="mx-auto max-w-6xl px-4 text-xs text-ink/50 sm:px-6">
+ <p className="container-wide text-xs text-ink/50">
```

- [ ] **Step 5: Test and commit**

Run: `npm test && npm run lint` — expected PASS.

```bash
git add src/app/globals.css src/components/site/Header.tsx \
  src/components/site/UspStrip.tsx src/components/site/Footer.tsx
git commit -m "Storefront: add container-wide (1600px) and widen header/footer/USP strip"
```

---

### Task 2: Widen home page + its loading state

**Files:**
- Modify: `src/app/(store)/page.tsx`
- Modify: `src/app/(store)/loading.tsx`

**Interfaces:**
- Consumes: `.container-wide` from Task 1.

- [ ] **Step 1: Widen the three home sections in `page.tsx`**

Hero container:

```
- <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center md:py-24">
+ <div className="container-wide grid gap-12 py-16 md:grid-cols-2 md:items-center md:py-24">
```

Hero collage — bigger images at `lg` (wrapper and tile):

```
- <div className="relative h-72 sm:h-96">
+ <div className="relative h-72 sm:h-96 lg:h-[30rem]">
```

```
- 'absolute aspect-3/4 w-36 overflow-hidden rounded-xl border border-surface shadow-lg sm:w-48',
+ 'absolute aspect-3/4 w-36 overflow-hidden rounded-xl border border-surface shadow-lg sm:w-48 lg:w-60',
```

Collage `Image` sizes:

```
- sizes="(max-width: 640px) 144px, 192px"
+ sizes="(max-width: 640px) 144px, (max-width: 1024px) 192px, 240px"
```

Category tiles section:

```
- <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
+ <section className="container-wide py-16">
```

New Arrivals island inner container:

```
- <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
+ <div className="container-wide py-16">
```

(New Arrivals grid stays `md:grid-cols-4` — 8 products, 4×2, bigger cards is the Casetify look.)

- [ ] **Step 2: Mirror in `loading.tsx`**

```
- <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center md:py-24">
+ <div className="container-wide grid gap-12 py-16 md:grid-cols-2 md:items-center md:py-24">
```

```
- <Skeleton className="h-72 w-full sm:h-96" />
+ <Skeleton className="h-72 w-full sm:h-96 lg:h-[30rem]" />
```

Both remaining sections:

```
- <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
+ <section className="container-wide py-16">
```

- [ ] **Step 3: Test and commit**

Run: `npm test && npm run lint` — expected PASS.

```bash
git add src/app/\(store\)/page.tsx src/app/\(store\)/loading.tsx
git commit -m "Storefront: widen home page to container-wide, larger hero collage at lg"
```

---

### Task 3: Widen products listing (5-up at xl) + ProductCard sizes

**Files:**
- Modify: `src/app/(store)/products/page.tsx:62,87`
- Modify: `src/app/(store)/products/loading.tsx:5,20`
- Modify: `src/components/site/ProductCard.tsx:23`

**Interfaces:**
- Consumes: `.container-wide` from Task 1.
- Produces: grid pattern `grid-cols-2 → md:grid-cols-4 → xl:grid-cols-5` reused verbatim by Task 4's RelatedProducts.

- [ ] **Step 1: Widen `products/page.tsx`**

```
- <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
+ <div className="container-wide py-12">
```

```
- <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
+ <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 xl:grid-cols-5">
```

- [ ] **Step 2: Mirror in `products/loading.tsx`**

```
- <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
+ <div className="container-wide py-12">
```

```
- <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
+ <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 xl:grid-cols-5">
```

- [ ] **Step 3: Update `ProductCard` image sizes for the 5-column step**

```
- sizes="(max-width: 768px) 50vw, 25vw"
+ sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 20vw"
```

- [ ] **Step 4: Test and commit**

Run: `npm test && npm run lint` — expected PASS.

```bash
git add src/app/\(store\)/products/page.tsx src/app/\(store\)/products/loading.tsx \
  src/components/site/ProductCard.tsx
git commit -m "Storefront: widen product listing, 5-up grid at xl"
```

---

### Task 4: Widen product detail + RelatedProducts

**Files:**
- Modify: `src/app/(store)/products/[slug]/page.tsx:74`
- Modify: `src/app/(store)/products/[slug]/loading.tsx:5`
- Modify: `src/components/site/RelatedProducts.tsx:8,10`

**Interfaces:**
- Consumes: `.container-wide` (Task 1) and the grid pattern from Task 3.

- [ ] **Step 1: Widen `products/[slug]/page.tsx`**

```
- <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
+ <div className="container-wide py-12">
```

- [ ] **Step 2: Mirror in `products/[slug]/loading.tsx`**

```
- <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
+ <div className="container-wide py-12">
```

- [ ] **Step 3: Widen `RelatedProducts.tsx`**

```
- <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
+ <section className="container-wide py-16">
```

```
- <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
+ <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 xl:grid-cols-5">
```

- [ ] **Step 4: Test and commit**

Run: `npm test && npm run lint` — expected PASS.

```bash
git add src/app/\(store\)/products/\[slug\]/page.tsx src/app/\(store\)/products/\[slug\]/loading.tsx \
  src/components/site/RelatedProducts.tsx
git commit -m "Storefront: widen product detail and related products"
```

---

### Task 5: Visual verification at wide + standard + mobile widths

**Files:** none (verification only).

- [ ] **Step 1: Confirm no `max-w-6xl` remains on wide surfaces**

Run: `grep -rn "max-w-6xl" src/`
Expected: NO matches. (Narrow surfaces use `max-w-2xl/3xl/4xl`, which are untouched.)

- [ ] **Step 2: Ensure the stack is running**

Check: `curl -sf http://localhost:3005 >/dev/null && curl -sf http://localhost:3002/products >/dev/null`
If down, boot per root `CLAUDE.md` "Full stack boot order" (Postgres → emulators → API :3002 → seed → storefront :3005).

- [ ] **Step 3: Browser check with Playwright MCP**

At viewport 1728×1000, visit and screenshot: `/` (hero, categories, new arrivals fill ~1600px), `/products` (5 columns), a product detail page (wide, related 5-up), `/cart` (still narrow — unchanged), scroll to footer (wide rows).
At 1280×900: `/products` shows 4 columns.
At 390×844: home and products unchanged vs. before (single/2-col, padding 1rem).
Expected: no horizontal scrollbars anywhere; narrow pages (cart/account) visually unchanged.

- [ ] **Step 4: Report results with screenshots**

---

## Self-Review Notes

- Spec coverage: token (T1), header/footer/USP (T1), home + loading (T2), products + loading + card sizes (T3), detail + loading + related (T4), narrow-surfaces-untouched (constraint), verification (T5). WIP separation handled by T0.
- No placeholders; every edit shows exact before/after class strings taken from the current files.
- `container-wide` name used consistently; grid step `xl:grid-cols-5` consistent between T3 and T4.
