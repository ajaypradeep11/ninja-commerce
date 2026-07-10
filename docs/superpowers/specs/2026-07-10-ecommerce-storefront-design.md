# Ecommerce Storefront — Design Spec (Phase 3)

**Date:** 2026-07-10
**Status:** Approved (autonomous execution per user directive; deviations from parent spec are logged in Decisions)
**Parent spec:** `2026-07-09-ecommerce-platform-design.md`
**Depends on:** `ecommerce-api` (Phase 1 + Phase 2 prep, branch `phase-2-admin-prep`), `ecommerce-admin` (Phase 2, complete — conventions reused)

## Overview

`ecommerce-storefront` is the customer-facing Next.js site: browse catalog, product detail with reviews, client-side cart, Stripe hosted checkout, order history and saved addresses. Third and final repo of the platform.

## Scope (v1)

Home, product listing (category filter + search + sort + pagination), product detail (gallery, accordions, reviews, related products), cart (localStorage), checkout via Stripe hosted page, success page, account (profile, saved addresses, order history + detail), auth (email/password sign-in/sign-up against the Firebase emulator), static pages (about, FAQ, shipping & returns, contact), 404.

Out of scope v1: newsletter capture (no API endpoint — footer shows contact email instead), Google sign-in button (pointless against emulator; add pre-production), wishlist, server-side cart, review pagination (API returns all), price-range filters (API has none).

## Stack & repo layout

New sibling repo `~/Work/Ecommerce/ecommerce-storefront` (own git repo). **Next.js 15 (App Router) + React 19 + TypeScript strict**, Tailwind v4 (CSS-first via `@tailwindcss/postcss`), shadcn/ui (new-york, CLI pinned 3.8.5), TanStack Query v5 (client data), react-hook-form + zod v4, `@hey-api/openapi-ts` v0.99 generated client, Firebase JS SDK v12 (Auth emulator), Vitest + Testing Library, Playwright (smoke). Dev server `http://localhost:3000` (already in the API's `CORS_ORIGINS` and `FRONTEND_URL`).

```
ecommerce-storefront/
  src/
    api/            # generated client (committed) + client config + unwrap + query hooks
    auth/           # firebase init (emulator wiring), AuthProvider, RequireAuth
    cart/           # localStorage cart store (useSyncExternalStore) + hooks
    components/     # ui/ (shadcn), site/ (Header, Footer, ProductCard, Price, RatingStars, …)
    lib/            # money, shipping-address normalizer, site config
    app/            # App Router routes (see Pages)
  .env.development / .env.example
```

## Rendering model

- **Public catalog pages are server components** (SEO): home, listing, product detail, static pages fetch the API server-side with `cache: 'no-store'` (live stock; ISR is a later optimization). `generateMetadata` on product pages.
- **Interactive islands are client components**: header cart badge, add-to-cart, cart page, auth pages, account area, review form, checkout button.
- Auth'd data (orders, /me, checkout, review create) is always fetched client-side with the Firebase ID token attached by a request interceptor (same pattern as admin). TanStack Query wraps client-side calls; server components call the generated SDK directly.

## API contract & prep (Part A, in `ecommerce-api`, branch `phase-3-storefront-prep` off `phase-2-admin-prep`)

The storefront consumes: `GET /products` (category slug, q, page/pageSize≤48, sort), `GET /products/:slug`, `GET /categories`, `GET /products/:id/reviews` + `POST` (purchase-gated: 403; duplicate: 409), `POST /checkout` (`{items:[{productId,quantity}]}` → `{url, orderId}`; 409 "Only N left of X"), `GET /orders/me`, `GET /orders/:id`, `GET /me`, `PUT /me/addresses` (whole-array), `GET /health`.

Prep required (the emitted OpenAPI spec is incomplete for storefront codegen):

1. **Swagger completeness** — response DTO classes + decorators for `POST /checkout` (`CheckoutSessionResponseDto { url, orderId }`), reviews (`ReviewResponseDto`, `ProductReviewsResponseDto { items, averageRating, count }`), users (`UserResponseDto`, addresses). Re-emit `openapi.json`.
2. **Storefront demo seed** — extend `seed:demo` (idempotent) to 4 categories / ~10 active products with deterministic placeholder images (`https://picsum.photos/seed/<slug>/<w>/<h>` — dev-only stand-ins) and a few reviews, so listing/gallery/rating UI is exercised.

No new endpoints. Success page works without a session-lookup route by polling `GET /orders/me` and matching `stripeSessionId` (checkout requires sign-in, so the buyer can always read their own orders).

## Auth

Firebase email/password against the auth emulator (`127.0.0.1:9098`, project `demo-ecommerce`, `NEXT_PUBLIC_USE_EMULATORS=true`). `/login` and `/signup` pages with `?next=` redirect. `AuthProvider` tracks `{user, loading}` (no admin claim needed). Request interceptor attaches `Authorization: Bearer <idToken>` on the client only; 401 responses force sign-out. `RequireAuth` guards `/account/**`; the cart page gates the checkout button (redirects to `/login?next=/cart`).

## Cart & checkout flow

Cart lives in localStorage (`everloom.cart.v1`): `{productId, slug, name, priceCents, image, quantity, stockQty}` — display fields are cached snapshots; the API re-validates everything at checkout. Cart page refreshes each line from `GET /products/:slug` on mount (price/stock drift, deactivated products flagged for removal), clamps quantity steppers to `stockQty`, and surfaces "Only N left" both proactively and from checkout 409s. Checkout: `POST /checkout` → `window.location.assign(url)`. Stripe redirects to `/checkout/success?session_id=…` (cart cleared on mount, poll `/orders/me` every 2s ≤60s: PENDING → "Payment received — confirming…", PAID → full confirmation, timeout → reassurance copy + link to orders) or back to `/cart` on cancel. Note: locally, orders reach PAID only when the Stripe CLI forwards webhooks; without real Stripe test keys checkout fails at session creation with a clean toast — full E2E needs the user's test keys.

## Design language

Own brand, editorial structure inspired by the reference (nothing copied). **Brand: "Everloom" — organic cotton basics** (single constant in `src/lib/site.ts`; trivially renameable).

- **Palette:** `cotton #FAF7F2` (page background), `ink #23201C` (text, warm near-black), `indigo #2F4A7A` (primary actions/links — denim), `madder #A64B35` (badges: sale/low-stock, natural-dye red, sparing), `flax #E7DFD2` (borders, tiles, skeletons).
- **Type:** display **Bricolage Grotesque** (headlines only, tight), body **Public Sans**, utility **IBM Plex Mono** for prices, badges, and eyebrow labels (the "price tag" voice). Loaded via `next/font`.
- **Signature:** the **selvedge stripe** — a thin woven-edge band (ink/cotton/madder hairlines, CSS gradient) as section divider, under the header, and on order-confirmation. One memorable device; everything else quiet.
- **Motion:** restrained — product-card hover lift, footer brand marquee (paused under `prefers-reduced-motion`). Visible keyboard focus everywhere.
- Copy voice: plain, specific, sentence case ("Ships in 48 hours", "Free returns for 30 days", "Organic cotton, always"). Errors say what happened and what to do.

## Pages

- **Home** — typographic hero on flax panel with product-image collage, category tiles (from API), "New arrivals" grid (newest 8), USP strip, footer with marquee.
- **/products** — grid of ProductCards (image, name, mono price, rating stars, LOW STOCK/OUT OF STOCK badges), category filter pills, sort select, search via `?q=` (header search submits here), URL-driven state, pagination. Doubles as the search-results page (deviation from parent spec's separate page — same data, one route).
- **/products/[slug]** — two-column: gallery (thumb strip) | sticky info (name, price, rating, stock line, qty selector, Add to cart), accordions (Details, Shipping & returns), reviews (aggregate + list + gated write form), "You may also like" (same category, excl. self, 4).
- **/cart** — line items with steppers, remove, subtotal (order total incl. shipping shown by Stripe), stock warnings, Checkout.
- **/checkout/success** — states per Checkout flow above.
- **/account** (guarded) — profile (email), saved addresses (add/edit/delete client-side → `PUT /me/addresses` whole array), **/account/orders** list (status badges) + **/account/orders/[id]** detail (item snapshots, shipping address — handles Stripe snake_case and saved camelCase shapes).
- **/login, /signup**, static **/about, /faq, /shipping-returns, /contact**, custom 404.

## Error handling

Same `unwrap` → `ApiError {status, message}` contract as admin (message strings; Nest has no error codes). 401 → sign-out; 403 review-gating → inline "Only verified buyers can review"; 409s → toast with API message; 5xx/network → retry banner. Error boundary + `not-found.tsx`.

## Testing

- **Vitest + Testing Library:** cart store (add/merge/clamp/subtotal/persistence), money, address normalizer, AuthProvider, cart page stock-refresh logic, review form gating states, address manager PUT-array behavior.
- **Playwright smoke** (against seeded API + emulators): home renders seeded products → listing filter → product detail → add to cart → cart math → emulator sign-up/sign-in → checkout attempt (asserts Stripe redirect when real test keys present — env-gated — else asserts clean error handling).

## Build order within this phase

1. API prep (Swagger completeness + storefront seed)
2. Scaffold (Next 15 + Tailwind v4 + shadcn + fonts + env + vitest)
3. Generated client + unwrap; lib/cart TDD; Firebase auth
4. Design system + home; listing; product detail; reviews
5. Cart + checkout + success; account area
6. Static pages + polish; Playwright; README + QA

## Decisions log (this phase)

- Brand "Everloom" chosen autonomously as a replaceable constant (user can rename in one file)
- Search merged into /products listing (one route, URL params) instead of a separate results page
- Success page polls /orders/me (no new API endpoint) — checkout is sign-in-gated so this always works
- Newsletter capture dropped in v1 (no endpoint; honest UX over fake success)
- Placeholder product photography via seeded picsum URLs, dev-only
- Full Stripe-test-mode E2E requires user-supplied test keys (`sk_test_…` real + Stripe CLI); everything else verifiable locally
