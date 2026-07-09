# Ecommerce Platform — Design Spec

**Date:** 2026-07-09
**Status:** Approved
**Design reference:** https://www.nonasties.in (screenshots in `reference/nonasties-screenshots/`)

## Overview

A three-repo ecommerce platform for a real business selling physical goods (simple single-SKU products, no variants) to US/Europe customers, with Stripe hosted checkout and a separate admin portal for inventory and order management.

| Repo | Stack | Deploys to |
|---|---|---|
| `ecommerce-storefront` | Next.js 15 (App Router, TypeScript, Tailwind) | Firebase App Hosting |
| `ecommerce-api` | NestJS 11 + Prisma + Postgres (Neon) | Cloud Run (Docker) |
| `ecommerce-admin` | React 19 + Vite + TypeScript (SPA) | Firebase Hosting |

All three live under `~/Work/Ecommerce/`, each its own git repository. This parent directory is a meta repo holding specs, plans, and design reference material.

## Architecture (backend-centric)

```
Storefront (Next.js) ──┐
                        ├──► NestJS API ──► Postgres
Admin (React) ──────────┘        │
                                 ├──► Stripe (sessions, refunds)
                                 ◄── Stripe webhooks
```

NestJS owns all data and all Stripe interaction: checkout session creation, webhooks, order creation, stock decrements, refunds. Both frontends are pure API clients.

**API contract:** the API publishes an OpenAPI spec via NestJS Swagger. Both frontends generate typed TypeScript clients from it, so the contract cannot silently drift.

## Data model (Postgres via Prisma)

- **Product** — name, slug, description, price (integer cents), images[] (Firebase Storage URLs), stockQty, active flag, categoryId. Single SKU; no variants.
- **Category** — name, slug, sortOrder.
- **Order** — userId, email, shipping address, stripeSessionId, stripePaymentIntentId, status, line-items snapshot (product name + unit price copied at purchase time so later product edits don't rewrite history), totals.
  - Status flow: `pending → paid → shipped → delivered`; terminal branches `cancelled`, `refunded`.
- **Review** — productId, userId, rating (1–5), text. One review per user per product; only permitted after the user has a delivered/paid order containing that product.
- **User** — Firebase UID (primary identity), email, role (`customer` | `admin`), saved addresses.

## Auth

- Firebase Auth (email/password + Google) on both storefront and admin.
- Every API request carries the Firebase ID token; a NestJS guard verifies it via Firebase Admin SDK.
- Admin routes require an `admin` custom claim; a one-off script grants that claim to the owner's email.
- The backend never stores passwords.

## Checkout flow

1. Cart is client-side (localStorage). No server cart in v1.
2. `POST /checkout`: NestJS re-validates stock and prices from the DB, creates a Stripe Checkout Session (`allow_promotion_codes: true` — discount codes are managed in the Stripe dashboard for v1), persists a `pending` order, returns the session URL.
3. Stripe's hosted page collects payment and shipping address.
4. Webhook `checkout.session.completed`: mark order `paid`, decrement stock atomically (guarded transaction — two buyers racing for the last unit cannot both succeed).
5. Success page shows the order. `pending` orders whose sessions expire are marked `cancelled`.

**Refunds:** admin triggers refund → NestJS calls Stripe refund API → webhook confirmation → order `refunded`, stock restored.

**Webhook hardening:** signature verification, idempotency by Stripe event ID, failed events logged for replay.

## Storefront pages (modeled on nonasties.in structure)

- **Home** — hero, category tiles, featured products, USP strip (shipping/returns), newsletter signup
- **Category listing** — filter + sort, sale/new badges, star ratings
- **Search** results
- **Product detail** — image gallery, accordion sections (details, shipping & returns), reviews, related products
- **Cart** (client-side) → Stripe hosted checkout → **order success** page
- **Account** — profile, saved addresses, order history (with per-order status)
- **Static pages** — about, FAQ, shipping/returns policy, contact

Design language: clean editorial layout with large photography, inspired by the reference site's structure — own branding and assets, nothing copied.

## Admin portal pages

- Login (Firebase Auth, admin claim required)
- Dashboard — basic counts (orders today, low-stock products)
- Products — list, create, edit, deactivate; image upload to Firebase Storage; stock adjustment
- Categories — CRUD, ordering
- Orders — list with filters, detail view, status transitions (paid → shipped → delivered), refund button

Out of scope for v1 admin: customer management, discount code UI (Stripe dashboard covers it), review moderation, analytics.

## Error handling

- Stock validated both at checkout-session creation and at webhook time; storefront surfaces "only N left" errors in the cart.
- All Stripe webhook failures are logged with payloads for manual replay.
- API returns structured error responses (code + message) that both frontends render consistently.

## Testing

- **NestJS:** Jest unit tests on services — checkout, webhook processing, and stock decrement logic are the priority; e2e API tests against a test database with Stripe test mode.
- **Storefront:** Playwright smoke test covering browse → cart → checkout (Stripe test card) → success.
- **Admin:** component tests on critical forms; manual QA for the rest in v1.

## Build order

Each phase gets its own implementation plan:

1. **`ecommerce-api`** — schema, auth guard, products/categories/orders/reviews modules, Stripe checkout + webhooks, OpenAPI spec
2. **`ecommerce-admin`** — inventory + order management against the live API
3. **`ecommerce-storefront`** — customer-facing site, end-to-end in Stripe test mode

## Decisions log

- Market: US/Europe → Stripe viable (India would have required Razorpay)
- Products: single SKU, no variants
- Checkout: Stripe hosted Checkout (not Elements)
- Discount codes: Stripe dashboard, not custom admin UI
- Database: Postgres (Neon) — relational fit for orders/inventory; not Firestore
- Auth: Firebase Auth with custom claims — no self-managed passwords
- Architecture: backend-centric; frontends never talk to Stripe directly
- Cart: client-side localStorage for v1
