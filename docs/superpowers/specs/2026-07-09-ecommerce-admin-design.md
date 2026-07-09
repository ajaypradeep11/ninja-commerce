# Ecommerce Admin Portal — Design Spec (Phase 2)

**Date:** 2026-07-09
**Status:** Approved
**Parent spec:** `2026-07-09-ecommerce-platform-design.md`
**Depends on:** `ecommerce-api` (Phase 1, complete)

## Overview

`ecommerce-admin` is a React SPA for the store owner to manage inventory and orders against the existing NestJS API. It is the second of three repos; the storefront (Phase 3) follows.

Decisions made in this brainstorm:

- **Build order:** admin before storefront (per parent spec).
- **Firebase:** develop against the local Firebase **Auth + Storage emulators**; switch to a real project later via env config only.
- **UI:** Tailwind v4 + shadcn/ui components.
- **API contract:** generated typed client from the API's OpenAPI spec (parent-spec decision reaffirmed), which requires a small API prep phase first.

## Scope (v1)

Per the parent spec: login, dashboard (orders today + low-stock counts), products (list/create/edit/deactivate, image upload, stock), categories CRUD with ordering, orders (list/filter/detail, status transitions, refund).

Out of scope: customer management, discount-code UI, review moderation, analytics, Google sign-in button (emulator makes it pointless in dev; add before production).

## Stack & repo layout

New sibling repo `~/Work/Ecommerce/ecommerce-admin` (own git repo). React 19 + Vite + TypeScript, Tailwind v4 + shadcn/ui, React Router v7 (library mode), TanStack Query v5, react-hook-form + zod, `@hey-api/openapi-ts` generated client, Firebase JS SDK. Dev server on `localhost:5174`; deploys to Firebase Hosting later.

```
ecommerce-admin/
  src/
    api/          # generated client (src/api/generated/, committed) + hand-written query hooks
    auth/         # Firebase init, AuthProvider, useAuth, route guard
    components/   # shadcn/ui primitives + shared (DataTable, ConfirmDialog, …)
    pages/        # dashboard/, products/, categories/, orders/, login
    lib/          # utils (cents↔dollars, date formatting)
  .env.development  # VITE_API_URL, VITE_FIREBASE_* (emulator values)
```

## API prep (changes in `ecommerce-api`, done first)

1. **Swagger response schemas** — enable the `@nestjs/swagger` CLI plugin in `nest-cli.json`; add response DTO classes for endpoints the admin consumes (products, categories, orders, paginated list wrappers) so the generated client gets real response types.
2. **Admin access to inactive products** — `GET /products?includeInactive=true` (admin-guarded flag; public callers still get active-only), plus fetch-by-ID for the edit form.
3. **Dashboard stats** — `GET /admin/stats` (admin-guarded) returning `{ ordersToday, lowStockProducts }`. "Orders today" = orders created since UTC midnight with status PAID or later; "low stock" = active products with `stockQty <= 5` (constant in the API, not configurable in v1).
4. **OpenAPI export** — `npm run openapi:emit` writes `openapi.json` for the admin repo to generate from.
5. **Emulator support** — API verifies emulator-issued tokens via `FIREBASE_AUTH_EMULATOR_HOST` (native Admin SDK behavior; config only).

## Auth

- Firebase JS SDK initialized from `VITE_FIREBASE_*`; dev calls `connectAuthEmulator` (and `connectStorageEmulator` for uploads).
- Login page: email/password.
- `AuthProvider` tracks the user and force-refreshes the ID token once at login to read the `admin` custom claim. Three states: signed out → login; signed in without claim → "not authorized" screen with sign-out; signed in with claim → app shell.
- All API requests attach `Authorization: Bearer <idToken>` via a fetch interceptor on the generated client; `getIdToken()` handles refresh.
- Dev seeding: `npm run seed:emulator` creates an emulator user and grants the `admin` claim (reuses the API's `grant-admin` script pointed at the emulator).

## Pages

App shell behind the auth guard: sidebar (Dashboard / Products / Categories / Orders), header with user email + sign out.

- **Dashboard** — two stat cards from `GET /admin/stats`; low-stock card links to the affected products.
- **Products** — DataTable (name, category, price, stock, active, rating) with search, category filter, include-inactive toggle; row click → edit. Create/edit share one form: name, slug (auto from name, editable), description, price (entered as dollars, stored as cents), category select, stock, active toggle, image upload to Firebase Storage (URL array, drag-to-reorder). Deactivate = soft toggle with confirm; hard delete only for never-ordered products (API enforces).
- **Categories** — table with inline create/rename, drag-to-reorder writing `sortOrder`, delete with confirm (API blocks deleting categories with products).
- **Orders** — DataTable (order #, date, email, total, status badge), status filter + email search, paginated. Detail: line-item snapshot, shipping address, Stripe IDs, status timeline. Actions shown only when legal per PAID→SHIPPED→DELIVERED: **Mark shipped**, **Mark delivered**; **Refund** with confirm dialog stating the amount — status flips to REFUNDED when the webhook lands, UI shows "refund pending" and polls until then.

## Data flow

`openapi.json` → `@hey-api/openapi-ts` → typed client in `src/api/generated/` (committed; regenerate via one script). Hand-written TanStack Query hooks wrap the generated client; mutations invalidate relevant query keys; lists refetch on window focus. No global state beyond auth context + query cache. Forms: react-hook-form + zod.

## Error handling

Single `ApiError` normalizer over the API's structured errors: 401 → force sign-out; 403 → not-authorized screen; 400/409 (validation, "category has products", illegal transition) → toast/field errors with the API message; 5xx/network → retryable banner. React error boundary around the routed area.

## Testing

Vitest + Testing Library component tests on the critical forms: product create/edit (dollars↔cents, slug generation, validation) and order actions (buttons legal per status, confirm flow). Query hooks tested against a mocked client. Rest is manual QA against real API + emulators. No Playwright in admin v1.

## Build order within this phase

1. API prep (items above, in `ecommerce-api`)
2. Admin scaffold: Vite + Tailwind + shadcn/ui + router + generated client + auth (emulator login working end-to-end)
3. Products + categories management
4. Orders management + dashboard
5. Component tests + manual QA pass
