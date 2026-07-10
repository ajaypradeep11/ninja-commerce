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
- Obsidian vault Memory folder: `~/MyEverything/Personal/Memory/` (this project's note: `Ecommerce Project Memory.md`)

## Tech Stack
| Layer | Choice |
|---|---|
| API | NestJS 11, Prisma 6.19, Postgres 16 (Docker local, Neon planned) |
| Auth | Firebase Auth (ID tokens verified by API; `admin: true` custom claim); local dev via Auth emulator |
| Payments | Stripe SDK v22, API version pinned `2026-06-24.dahlia`, hosted Checkout |
| Admin (Phase 2) | React 19 + Vite SPA, TS strict, Tailwind v4 + shadcn/ui, React Router 7, TanStack Query 5, RHF+zod v4, @hey-api/openapi-ts generated client |
| Storefront (Phase 3) | Next.js 15, Tailwind |

## What's Built (2026-07-10)
**Phase 1 — `ecommerce-api` — COMPLETE** (on master)
- Products/categories CRUD (public reads, admin writes), search/filter/pagination, review aggregates
- Checkout: PENDING order with line-item snapshots → Stripe session; webhooks idempotent, atomic stock decrement; orders admin transitions + refund trigger; reviews purchase-gated; users Firebase-UID upsert
- Swagger at /docs, `npm run grant-admin -- <email>`

**Phase 2 — `ecommerce-admin` + API prep — COMPLETE** (2026-07-10, merged to master in both repos; final whole-branch review: ready to merge, Important fix applied)
- API prep: Swagger CLI plugin + response DTOs (`ProductBaseResponseDto` for writes / `ProductResponseDto` enriched for reads, orders/admin-stats DTOs), `GET /products/id/:id` (admin, incl. inactive), `GET /orders?email=` filter, `GET /admin/stats` (ordersToday = PAID+ since UTC midnight; low stock = active ≤ 5), `npm run openapi:emit` (committed `openapi.json`), emulator support + `seed:emulator`/`seed:demo`
- Admin SPA (new repo, own git, on master): Firebase Auth (emulator) + admin-claim gate, generated typed client + unwrap/ApiError + 401 auto-signout, app shell, dashboard, categories (CRUD + dnd reorder), products (list/filters/create/edit + Firebase Storage image upload), orders (list/filters/detail/status transitions/refund with pending-poll), README
- Tests: api 57 unit + 8 e2e; admin 41 unit (Vitest+RTL); all green; 12-point browser QA passed (driven via cmux)

## How to Run (admin dev loop — 4 processes)
```bash
cd ecommerce-api && docker compose up -d db
cd ecommerce-admin && npm run emulators     # needs: export PATH=/opt/homebrew/opt/openjdk/bin:$PATH
cd ecommerce-api && PORT=3002 npm run start:dev
cd ecommerce-admin && npm run dev           # http://localhost:5174
# once: (api) npm run seed:emulator && npm run seed:demo  → admin@example.com / password123
# client regen: (api) npm run openapi:emit → (admin) npm run generate:api
```

## Key Files
- Specs: `docs/superpowers/specs/2026-07-09-ecommerce-platform-design.md`, `...-ecommerce-admin-design.md`
- Plans: `docs/superpowers/plans/2026-07-09-ecommerce-api.md`, `...-ecommerce-admin.md`
- Progress ledger (Phase 2, per-task reviews + deferred minors): `.superpowers/sdd/progress.md` (meta repo, gitignored)
- Schema: `ecommerce-api/prisma/schema.prisma`

## Gotchas / Lessons
- Ports on this machine: 3001, 9099 (auth), 4000 occupied by unrelated processes → API dev on **3002**, auth emulator **9098**, emulator UI **4001** (baked into firebase.json/env)
- Emulators need Java: `export PATH=/opt/homebrew/opt/openjdk/bin:$PATH`
- `npm run lint` in ecommerce-api auto-fixes — don't run casually; `import type` needed for decorated signatures
- ecommerce-api compiles to `dist/src/...` (scripts/ pulls rootDir up) — `start:prod` (`node dist/main`) is broken, fix pending
- @nestjs/swagger CLI plugin can't document whole-DTO `@Query()` params → manual `@ApiQuery` decorators on findAll routes
- Radix Select in WKWebView automation: option clicks don't register — drive with keyboard (ArrowDown+Enter); Radix hidden-select sync race clobbered form.reset values → reset deferred a macrotask (regression-tested)
- shadcn CLI pinned 3.8.5 (v4 CLI incompatible with classic init); zod v4: `z.coerce.number<number>()` for RHF typing
- Demo data drift from QA: both seed orders SHIPPED; `qa-special` product exists inactive; `viewer@example.com` non-admin emulator user exists

## What's Next (Ideas)
- **Phase 3: `ecommerce-storefront`** (Next.js) — end-to-end in Stripe test mode
- Phase 3 follow-ups from final review: fix `start:prod` dist path; e2e guard test for /admin/stats; keyboard row nav (a11y); `@IsUrl require_tld` env-conditioning; lock down storage.rules pre-deploy; CI guard for openapi.json↔client sync; reorder mutation `onSettled`; ImageUpload remove-by-index; empty-stock zod coercion; search debounce; 403 → not-authorized screen
- Pre-launch payments hardening: `async_payment_succeeded` handling or restrict to card; order `needsAttention` flag
- Deployment: Cloud Run + Neon; smoke-test grant-admin with real credentials
