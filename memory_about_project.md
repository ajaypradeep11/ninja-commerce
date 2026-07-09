# Ecommerce Platform — Project Memory

## About the User
- Building a real business selling physical goods to US/Europe customers
- Email: ceotwopeace@gmail.com

## Preferences
- Three separate repos: `ecommerce-storefront` (Next.js), `ecommerce-api` (NestJS), `ecommerce-admin` (React/Vite)
- Deploy target: Firebase (App Hosting / Hosting) + Cloud Run for the API
- Stripe hosted Checkout (not Elements); discount codes managed in Stripe dashboard
- Design reference: https://www.nonasties.in (screenshots in `reference/nonasties-screenshots/`)
- Subagent-driven development with per-task review; plans in `docs/superpowers/plans/`

## Tech Stack
| Layer | Choice |
|---|---|
| API | NestJS 11, Prisma 6.19, Postgres 16 (Docker local, Neon planned) |
| Auth | Firebase Auth (ID tokens verified by API; `admin: true` custom claim) |
| Payments | Stripe SDK v22, API version pinned `2026-06-24.dahlia`, hosted Checkout |
| Storefront (Phase 3) | Next.js 15, Tailwind |
| Admin (Phase 2) | React 19 + Vite SPA |

## What's Built (2026-07-09)
**Phase 1 — `ecommerce-api` — COMPLETE** (19 commits on master, final review verdict: ready to merge)
- Products/categories CRUD (public reads, admin writes), search/filter/pagination, review aggregates
- Checkout: PENDING order with line-item snapshots → Stripe session (`metadata.orderId`, promo codes)
- Webhooks: idempotent (dedup row + side effects in one transaction), atomic stock decrement, `payment_status` guard, partial-refund guard, shipping address from `collected_information.shipping_details`
- Orders: customer history, admin status transitions (PAID→SHIPPED→DELIVERED), Stripe refund trigger
- Reviews: purchase-gated, one per user per product
- Users: Firebase-UID upsert, saved addresses (Json)
- Swagger at /docs, `npm run grant-admin -- <email>` script
- Tests: 53 unit + 8 e2e (real Postgres, faked Firebase/Stripe); strict TS build clean

## How to Run
```bash
cd ecommerce-api
docker compose up -d db
npx prisma migrate dev
npm run start:dev        # PORT 3001 (occupied on this machine — use PORT=3099 override)
npm test && npm run test:e2e
```

## Key Files
- Spec: `docs/superpowers/specs/2026-07-09-ecommerce-platform-design.md`
- Phase 1 plan: `docs/superpowers/plans/2026-07-09-ecommerce-api.md`
- Progress ledger: `ecommerce-api/.superpowers/sdd/progress.md` (gitignored)
- Schema: `ecommerce-api/prisma/schema.prisma`

## Gotchas / Lessons
- `npm run lint` in ecommerce-api auto-fixes (eslint --fix) — do not run casually
- `import type` required for pure types in decorated signatures (isolatedModules + emitDecoratorMetadata)
- Port 3001 occupied by an unrelated local process
- Webhook test fixtures must use distinct billing vs shipping addresses (a same-address fixture hid a real bug)

## What's Next (Ideas)
- **Phase 2: `ecommerce-admin`** (React/Vite) — needs first: Swagger response schemas (@nestjs/swagger CLI plugin + response classes) so client generation yields typed responses; admin fetch of inactive products
- **Phase 3: `ecommerce-storefront`** (Next.js) — end-to-end in Stripe test mode
- Pre-launch payments hardening: `async_payment_succeeded` handling or restrict `payment_method_types: ['card']`; shortfall visibility flag (order `needsAttention`) instead of log-only
- Housekeeping batch: `@IsNotEmpty` sweep, CORS origin trim, refund idempotency key, signature-failure logging, README test-DB setup step
- Deployment: Cloud Run + Neon; smoke-test grant-admin with real credentials
