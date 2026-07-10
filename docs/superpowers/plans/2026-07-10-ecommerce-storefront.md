# Ecommerce Storefront (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `ecommerce-storefront`, the customer-facing Next.js site (browse → product → cart → Stripe hosted checkout → orders/account), plus the small API prep that makes typed client generation possible.

**Architecture:** Part A completes the API's OpenAPI response schemas (checkout, reviews, users) and enriches the demo seed. Part B scaffolds a Next.js 15 App Router app: public catalog pages are server components calling a generated `@hey-api/openapi-ts` client; interactive islands (cart, auth, checkout, reviews, account) are client components with a Firebase ID-token request interceptor and TanStack Query. Cart is a localStorage store read via `useSyncExternalStore`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript strict, Tailwind v4 (CSS-first), shadcn/ui (CLI 3.8.5), TanStack Query v5, react-hook-form + zod v4, @hey-api/openapi-ts v0.99 + @hey-api/client-fetch, Firebase JS SDK v12 (Auth emulator), Vitest 4 + Testing Library, Playwright. API side: NestJS 11 + @nestjs/swagger.

**Spec:** `/Users/ajaypradeepm/Work/Ecommerce/docs/superpowers/specs/2026-07-10-ecommerce-storefront-design.md`

## Global Constraints

- Two repos are touched. Tasks 1–2 commit to `/Users/ajaypradeepm/Work/Ecommerce/ecommerce-api` on branch `phase-3-storefront-prep` (create from `phase-2-admin-prep`). Tasks 3–16 commit to `/Users/ajaypradeepm/Work/Ecommerce/ecommerce-storefront` (new repo, created in Task 3, branch `master`). Never commit to the meta repo (`~/Work/Ecommerce`).
- All prices are **integer cents** end-to-end; the UI renders via `formatCents` (`src/lib/money.ts`). Currency is USD.
- TypeScript **strict** in both repos. TDD: every task with logic writes the failing test first. Commit at the end of every task (smaller commits within a task are fine).
- Brand name **"Everloom"** and all brand copy come only from `src/lib/site.ts` — never hard-code the brand string in components.
- Design tokens (exact): colors `cotton #FAF7F2`, `ink #23201C`, `indigo #2F4A7A`, `madder #A64B35`, `flax #E7DFD2`; fonts Bricolage Grotesque (display), Public Sans (body), IBM Plex Mono (prices/labels/badges), all via `next/font/google`.
- Ports on this machine: storefront `http://localhost:3000`; API `PORT=3002` (3001 is occupied; `.env` default stays 3001); Firebase Auth emulator `127.0.0.1:9098`, emulator UI `4001`, storage `9199` (started from `ecommerce-admin`: `npm run emulators`); Postgres via `docker compose up -d db` in ecommerce-api. Emulator project id `demo-ecommerce`.
- Storefront env: `NEXT_PUBLIC_API_URL=http://localhost:3002`, `NEXT_PUBLIC_FIREBASE_API_KEY=fake-api-key`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-ecommerce.firebaseapp.com`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-ecommerce`, `NEXT_PUBLIC_USE_EMULATORS=true` in `.env.development` (committed, fake values only) and blank template `.env.example`.
- Server components fetch with the generated SDK and `cache: 'no-store'` (pass `next` fetch options via the client's `fetch` — see Task 4). Auth'd calls (`/orders*`, `/me*`, `POST /checkout`, `POST …/reviews`) happen **only in client components**.
- The API has no machine-readable error codes: branch on `ApiError.status` and render `ApiError.message` (e.g. checkout 409 `"Only 3 left of Heavyweight Hoodie"`).
- Stripe: local `.env` has placeholder `sk_test_replace_me` — `POST /checkout` fails after creating a PENDING order (order flips CANCELLED, API returns 500). The UI must handle this cleanly. Full checkout E2E is env-gated behind real test keys (user-supplied).
- In ecommerce-api: use `import type` for types only used in decorated signatures; `npm run lint` auto-fixes — don't run casually. API unit tests mock `PrismaService`/`FirebaseService`/`StripeService` (existing pattern).
- Storefront lint/format mirrors admin: **oxlint** (copy `.oxlintrc.json` from ecommerce-admin) + **prettier** (`{"singleQuote": true, "trailingComma": "all"}`). No eslint.
- jsdom test stubs (copy admin `src/setupTests.ts`): `scrollIntoView`, `hasPointerCapture`, `releasePointerCapture` no-ops and `ResizeObserver ??=` stub.
- Never run `next build` and the dev server concurrently in the same checkout (`.next` clobbering).

---

## Part A — API prep (`ecommerce-api`, branch `phase-3-storefront-prep`)

### Task 1: OpenAPI completeness — checkout, reviews, users response DTOs

**Files:**
- Create: `src/checkout/dto/checkout-response.dto.ts`
- Create: `src/reviews/dto/review-response.dto.ts`
- Create: `src/users/dto/user-response.dto.ts`
- Modify: `src/checkout/checkout.controller.ts`
- Modify: `src/reviews/reviews.controller.ts`
- Modify: `src/users/users.controller.ts`
- Modify: `src/reviews/reviews.service.ts` (return-type annotation only, if needed)
- Regenerate: `openapi.json` (repo root)

**Interfaces:**
- Consumes: existing controllers/services (do not change behavior), `emit-openapi` script from Phase 2 (`npm run openapi:emit`).
- Produces: `openapi.json` containing typed schemas `CheckoutSessionResponseDto { url: string; orderId: string }`, `ReviewResponseDto { id, productId, userId, rating, text, createdAt }`, `ProductReviewsResponseDto { items: ReviewResponseDto[]; averageRating: number | null; count: number }`, `UserResponseDto { id, email, role, addresses, createdAt, updatedAt }`. Task 4 (client generation) depends on these exact names.

- [ ] **Step 1: Create branch**

```bash
cd /Users/ajaypradeepm/Work/Ecommerce/ecommerce-api
git checkout phase-2-admin-prep && git pull --ff-only 2>/dev/null; git checkout -b phase-3-storefront-prep
```

- [ ] **Step 2: Checkout response DTO**

`src/checkout/dto/checkout-response.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';

export class CheckoutSessionResponseDto {
  @ApiProperty({ description: 'Stripe hosted checkout URL to redirect the customer to' })
  url!: string;

  @ApiProperty({ description: 'Local order id created in PENDING state' })
  orderId!: string;
}
```

In `src/checkout/checkout.controller.ts`, add to the POST handler (keep existing decorators/signature):

```ts
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { CheckoutSessionResponseDto } from './dto/checkout-response.dto';
// on the class: @ApiBearerAuth()
// on create():
@ApiOperation({ summary: 'Create a Stripe Checkout session for the current cart' })
@ApiCreatedResponse({ type: CheckoutSessionResponseDto })
```

Match the exact decorator style used in `src/orders/orders.controller.ts` (Phase 2 pattern). Do not change the service.

- [ ] **Step 3: Reviews response DTOs**

`src/reviews/dto/review-response.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';

export class ReviewResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) rating!: number;
  @ApiProperty() text!: string;
  @ApiProperty() createdAt!: Date;
}

export class ProductReviewsResponseDto {
  @ApiProperty({ type: [ReviewResponseDto] }) items!: ReviewResponseDto[];
  @ApiProperty({ type: Number, nullable: true }) averageRating!: number | null;
  @ApiProperty() count!: number;
}
```

In `src/reviews/reviews.controller.ts`: class gets `@ApiTags('reviews')` if missing; `GET` gets `@ApiOkResponse({ type: ProductReviewsResponseDto })`; `POST` gets `@ApiBearerAuth()` + `@ApiCreatedResponse({ type: ReviewResponseDto })` + `@ApiOperation({ summary: 'Create a review (purchase-gated, one per user per product)' })`.

- [ ] **Step 4: Users response DTO**

`src/users/dto/user-response.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { AddressDto } from './update-addresses.dto';

export class UserResponseDto {
  @ApiProperty({ description: 'Firebase UID' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ['CUSTOMER', 'ADMIN'] }) role!: string;
  @ApiProperty({ type: [AddressDto] }) addresses!: AddressDto[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
```

In `src/users/users.controller.ts`: `@ApiBearerAuth()` on the class; `GET /me` → `@ApiOkResponse({ type: UserResponseDto })`; `PUT /me/addresses` → `@ApiOkResponse({ type: UserResponseDto })`. If `AddressDto` lacks `@ApiProperty` decorators, add them (`label?`, `line1`, `line2?`, `city`, `state?`, `postalCode`, `country` — optionals get `@ApiProperty({ required: false })`).

- [ ] **Step 5: Build, emit, verify schemas present**

```bash
npm run openapi:emit
node -e "
const s = require('./openapi.json');
const need = ['CheckoutSessionResponseDto','ReviewResponseDto','ProductReviewsResponseDto','UserResponseDto'];
const have = Object.keys(s.components.schemas);
const missing = need.filter(n => !have.includes(n));
if (missing.length) { console.error('MISSING:', missing); process.exit(1); }
const co = s.paths['/checkout'].post;
if (!co.responses['201']) { console.error('checkout 201 missing'); process.exit(1); }
console.log('openapi OK');
"
```

Expected: `openapi OK`.

- [ ] **Step 6: Run test suites (no behavior change expected)**

```bash
npm test 2>&1 | tail -5
```

Expected: all suites pass (57 unit tests as of Phase 2 end).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: complete OpenAPI response schemas for checkout, reviews, users (storefront codegen)"
```

### Task 2: Storefront demo seed — richer catalog with images and reviews

**Files:**
- Modify: `scripts/seed-demo-data.ts`

**Interfaces:**
- Consumes: existing idempotent-upsert seed pattern in `scripts/seed-demo-data.ts` (categories `tees`, `hoodies`; products `organic-cotton-tee`, `heavyweight-hoodie`, `retired-crewneck`; demo user `demo-buyer-uid`).
- Produces (Tasks 7–15 and QA depend on these exact slugs): categories `tees`, `hoodies`, `sweatpants`, `accessories` (sortOrder 1–4). Ten **active** products spread across them, each with `images: [picsum×3]` — plus the existing inactive `retired-crewneck` untouched. Reviews on `organic-cotton-tee` (3 reviews, avg 4.33) and `heavyweight-hoodie` (1 review, rating 5).

- [ ] **Step 1: Extend the seed (idempotent)**

Keep every existing upsert. Add two categories and seven new products using the same upsert style. Exact catalog to upsert (`priceCents`, `stockQty`; every product gets `images: imgs(slug)` and a 2–3 sentence description in the seed file; write real copy, e.g. the tee: "A mid-weight everyday tee in 100% GOTS-certified organic cotton. Pre-washed so it keeps its shape."):

```ts
const imgs = (slug: string) => [1, 2, 3].map(
  (n) => `https://picsum.photos/seed/${slug}-${n}/900/1125`,
);

// categories: tees(1), hoodies(2), sweatpants(3), accessories(4)
// products (slug, name, cents, stock, category):
// organic-cotton-tee      Organic Cotton Tee       2900  40  tees      (exists — add images via update)
// heavyweight-hoodie      Heavyweight Hoodie       7900   3  hoodies   (exists — add images)
// retired-crewneck        Retired Crewneck         5900   0  hoodies   (exists, INACTIVE — leave as is, add images only)
// boxy-tee-ecru           Boxy Tee — Ecru          3200  25  tees
// longsleeve-indigo       Longsleeve — Indigo      3900  18  tees
// pocket-tee-madder       Pocket Tee — Madder      3400   0  tees      (active, out of stock — UI state)
// zip-hoodie-flax         Zip Hoodie — Flax        8900  12  hoodies
// french-terry-sweatpant  French Terry Sweatpant   6900  20  sweatpants
// lounge-short            Lounge Short             4400   5  sweatpants (low stock — badge state)
// beanie-rib-knit         Rib Knit Beanie          2400  30  accessories
// tote-everyday           Everyday Tote            1800  50  accessories
// canvas-cap              Canvas Cap               2800  14  accessories
```

Reviews: upsert two more demo users (`demo-reviewer-1-uid`/`reviewer1@example.com`, `demo-reviewer-2-uid`/`reviewer2@example.com`, role CUSTOMER, addresses `[]`), then upsert reviews keyed by the `(productId, userId)` unique constraint: tee ← ratings 5, 4, 4 (one per demo user incl. `demo-buyer-uid`, short real text like "Washes well, no shrinking after a month."), hoodie ← rating 5 from `demo-buyer-uid`. Use `prisma.review.upsert` with the compound unique key.

- [ ] **Step 2: Run twice, verify idempotency and counts**

```bash
npm run seed:demo && npm run seed:demo
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const [cats, prods, active, reviews] = await Promise.all([
    p.category.count(), p.product.count(),
    p.product.count({ where: { active: true } }), p.review.count(),
  ]);
  console.log({ cats, prods, active, reviews });
  if (cats !== 4 || prods !== 12 || active !== 11 || reviews < 4) process.exit(1);
  await p.\$disconnect();
})();
"
```

Expected: `{ cats: 4, prods: 12, active: 11, reviews: 4 }` and exit 0 (counts stable across the two runs).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: enrich demo seed for storefront (4 categories, 12 products with images, reviews)"
```

---

## Part B — Storefront (`ecommerce-storefront`, new repo)

### Task 3: Scaffold the storefront app

**Files:**
- Create: repo `/Users/ajaypradeepm/Work/Ecommerce/ecommerce-storefront` (git init) via `create-next-app`
- Create: `src/lib/site.ts`, `.env.development`, `.env.example`, `.prettierrc`, `.oxlintrc.json`, `vitest.config.ts`, `src/setupTests.ts`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (placeholder), `next.config.ts`, `package.json`, `tsconfig.json`, `components.json` (shadcn init)

**Interfaces:**
- Produces: design tokens as Tailwind theme + CSS vars (`--color-cotton|ink|indigo|madder|flax`, `--font-display|sans|mono`); `SITE` config object `{ name, tagline, description, contactEmail, usps: {icon: 'clock'|'truck'|'undo'; text: string}[] }` from `src/lib/site.ts`; `cn()` from `src/lib/utils.ts` (shadcn); test commands `npm test`, `npm run dev` on port 3000. All later tasks import these.

- [ ] **Step 1: Scaffold**

```bash
cd /Users/ajaypradeepm/Work/Ecommerce
npx create-next-app@15 ecommerce-storefront --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-npm --turbopack
cd ecommerce-storefront
```

Verify `package.json` has `next` 15.x, `react` 19.x, `tailwindcss` ^4. If `create-next-app@15` scaffolds ESLint anyway, delete `eslint.config.*` and the eslint deps.

- [ ] **Step 2: Tooling — prettier, oxlint, vitest**

```bash
npm i -D prettier oxlint vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom vite-tsconfig-paths
cp ../ecommerce-admin/.oxlintrc.json .
printf '{\n  "singleQuote": true,\n  "trailingComma": "all"\n}\n' > .prettierrc
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

`src/setupTests.ts` — copy from `../ecommerce-admin/src/setupTests.ts` (jest-dom import + `scrollIntoView`/pointer-capture no-ops + `ResizeObserver ??=` stub), it is framework-agnostic.

package.json scripts (add/replace):

```json
"lint": "oxlint",
"format": "prettier --write src",
"test": "vitest run --passWithNoTests",
"test:watch": "vitest",
"generate:api": "openapi-ts"
```

Add `"types": ["vitest/globals", "@testing-library/jest-dom"]` to `tsconfig.json` compilerOptions. Verify `"strict": true` is present (create-next-app default — confirm, Phase 2 was bitten by a missing strict).

- [ ] **Step 3: Env files**

`.env.development` (committed — fake/local values only) and `.env.example` (same keys, empty values):

```
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_FIREBASE_API_KEY=fake-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-ecommerce.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-ecommerce
NEXT_PUBLIC_USE_EMULATORS=true
```

- [ ] **Step 4: Fonts + design tokens**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Bricolage_Grotesque, Public_Sans, IBM_Plex_Mono } from 'next/font/google';
import { SITE } from '@/lib/site';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display' });
const sans = Public_Sans({ subsets: ['latin'], variable: '--font-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s — ${SITE.name}` },
  description: SITE.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="bg-cotton font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
```

`src/app/globals.css` (replace scaffold content; keep the `@import 'tailwindcss'` line):

```css
@import 'tailwindcss';

@theme {
  --color-cotton: #faf7f2;
  --color-ink: #23201c;
  --color-indigo: #2f4a7a;
  --color-madder: #a64b35;
  --color-flax: #e7dfd2;
  --font-display: var(--font-display);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
}

/* Signature: selvedge stripe — woven-edge band used as section divider */
.selvedge {
  height: 6px;
  background: repeating-linear-gradient(
    90deg,
    var(--color-ink) 0 12px,
    var(--color-cotton) 12px 16px,
    var(--color-ink) 16px 28px,
    var(--color-madder) 28px 32px
  );
}

:focus-visible {
  outline: 2px solid var(--color-indigo);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Site config**

`src/lib/site.ts`:

```ts
export const SITE = {
  name: 'Everloom',
  tagline: 'Organic cotton basics, made to last.',
  description:
    'Everloom makes organic cotton basics — tees, hoodies, and everyday essentials that ship in 48 hours and last for years.',
  contactEmail: 'hello@everloom.example',
  usps: [
    { icon: 'clock', text: 'Ships in 48 hours' },
    { icon: 'undo', text: 'Free returns for 30 days' },
    { icon: 'leaf', text: 'Organic cotton, always' },
  ],
} as const;
```

- [ ] **Step 6: shadcn init + base components**

```bash
npx shadcn@3.8.5 init -y --base-color neutral
npx shadcn@3.8.5 add button input label select accordion dialog badge separator skeleton sonner
```

If init asks about React Server Components, accept defaults for Next. Verify `src/components/ui/button.tsx` exists and `src/lib/utils.ts` exports `cn`.

- [ ] **Step 7: next.config, placeholder home, smoke test**

`next.config.ts`: add

```ts
images: { remotePatterns: [{ protocol: 'https', hostname: 'picsum.photos' }] },
```

`src/app/page.tsx` (placeholder until Task 7):

```tsx
import { SITE } from '@/lib/site';

export default function Home() {
  return (
    <main className="p-16">
      <h1 className="font-display text-5xl">{SITE.name}</h1>
      <p className="mt-4 font-mono text-sm">{SITE.tagline}</p>
      <div className="selvedge mt-8 max-w-md" />
    </main>
  );
}
```

`src/lib/site.test.ts` (proves vitest wiring):

```ts
import { SITE } from './site';

test('site config exposes brand and USPs', () => {
  expect(SITE.name).toBe('Everloom');
  expect(SITE.usps.length).toBeGreaterThanOrEqual(3);
});
```

```bash
npm test          # 1 passing
npm run build     # compiles clean, strict TS
npm run dev       # manual: http://localhost:3000 shows Everloom + selvedge, then stop
```

- [ ] **Step 8: Init repo and commit**

```bash
git init -b master && git add -A && git commit -m "chore: scaffold Next 15 storefront (Tailwind v4, shadcn, vitest, design tokens, site config)"
```

### Task 4: Generated API client, unwrap, server fetch wiring

**Files:**
- Create: `openapi-ts.config.ts`, `src/api/client.ts`, `src/api/unwrap.ts`, `src/api/unwrap.test.ts`, `src/api/server.ts`
- Create (generated): `src/api/generated/**` (committed)

**Interfaces:**
- Consumes: `../ecommerce-api/openapi.json` (Task 1 output — regenerate there first if stale).
- Produces (all later tasks): generated SDK functions (`productsControllerFindAll`, `productsControllerFindBySlug`, `categoriesControllerFindAll`, `reviewsControllerList`, `reviewsControllerCreate`, `checkoutControllerCreate`, `ordersControllerFindMine`, `ordersControllerFindOne`, `usersControllerMe`, `usersControllerUpdateAddresses` — use the actual generated names, discover via `src/api/generated/sdk.gen.ts`) and types (`ProductResponseDto`, `PaginatedProductsDto`, `CategoryResponseDto`, `OrderResponseDto`, `CheckoutSessionResponseDto`, `ProductReviewsResponseDto`, `UserResponseDto`, `AddressDto`).
- `unwrap<T>(call): Promise<T>` — throws `ApiError { status: number; message: string }` when `error !== undefined` or the fetch rejects; message joins Nest validation arrays.
- `serverFetchOptions` — `{ cache: 'no-store' as const }`, spread into SDK calls from server components: `productsControllerFindAll({ query, fetch: undefined, ...serverFetchOptions })` → concretely the hey-api fetch client accepts per-call `{ cache }` passthrough; verify the generated client forwards RequestInit and document the working pattern in `src/api/server.ts`.

- [ ] **Step 1: Generator config + generate**

```bash
npm i -D @hey-api/openapi-ts@0.99 && npm i @hey-api/client-fetch
```

`openapi-ts.config.ts` (mirror `../ecommerce-admin/openapi-ts.config.ts` exactly, adjusting nothing but paths if needed):

```ts
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../ecommerce-api/openapi.json',
  output: { path: 'src/api/generated', format: 'prettier' },
  plugins: ['@hey-api/client-fetch'],
});
```

```bash
npm run generate:api
```

Verify `src/api/generated/types.gen.ts` contains `CheckoutSessionResponseDto` and `ProductReviewsResponseDto` (Task 1 landed) — if missing, stop and re-emit in the API repo first.

- [ ] **Step 2: Client config**

`src/api/client.ts`:

```ts
import { client } from '@/api/generated/client.gen';

client.setConfig({ baseUrl: process.env.NEXT_PUBLIC_API_URL });

export { client };
```

(Interceptor registration is client-only and happens in Task 6 — this module must stay importable from server components.)

`src/api/server.ts`:

```ts
// Server-component fetch options: always fresh (live stock/prices).
export const serverFetchOptions = { cache: 'no-store' } as const;
```

Import `@/api/client` once from `src/app/layout.tsx` (side-effect import) so `setConfig` runs in every runtime:

```ts
import '@/api/client';
```

- [ ] **Step 3: unwrap (TDD — write the test first)**

`src/api/unwrap.test.ts` (port the admin tests, same contract):

```ts
import { unwrap, ApiError } from './unwrap';

test('returns data when no error', async () => {
  await expect(unwrap(Promise.resolve({ data: { ok: 1 }, error: undefined, response: new Response() }))).resolves.toEqual({ ok: 1 });
});

test('throws ApiError with status and message', async () => {
  const call = Promise.resolve({
    data: undefined,
    error: { statusCode: 409, message: 'Only 3 left of Heavyweight Hoodie', error: 'Conflict' },
    response: new Response(null, { status: 409 }),
  });
  const err = await unwrap(call).catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(409);
  expect(err.message).toBe('Only 3 left of Heavyweight Hoodie');
});

test('joins validation message arrays', async () => {
  const call = Promise.resolve({
    data: undefined,
    error: { statusCode: 400, message: ['rating must not be greater than 5', 'text must be a string'], error: 'Bad Request' },
    response: new Response(null, { status: 400 }),
  });
  const err = await unwrap(call).catch((e) => e);
  expect(err.message).toBe('rating must not be greater than 5. text must be a string');
});

test('network failure surfaces status 0', async () => {
  const err = await unwrap(Promise.reject(new TypeError('fetch failed'))).catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(0);
});
```

Run `npm test` → new tests FAIL (module missing). Then `src/api/unwrap.ts` — port from `../ecommerce-admin/src/api/unwrap.ts` (same `SdkResult` shape with optional `response`, `error !== undefined` discrimination, array-joining, status-0 catch wrapper). Run `npm test` → PASS.

- [ ] **Step 4: Server round-trip sanity check (manual, services running)**

With Postgres + API (`PORT=3002 npm run start:dev`) up and seed applied:

```bash
node -e "
fetch('http://localhost:3002/products?pageSize=2').then(r => r.json()).then(d => {
  console.log(d.total >= 11 ? 'API OK' : 'unexpected total', d.total);
});
"
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: generated typed API client with unwrap and server fetch options"
```

### Task 5: Pure logic — money, shipping-address normalizer, cart store (TDD)

**Files:**
- Create: `src/lib/money.ts`, `src/lib/money.test.ts`
- Create: `src/lib/shipping-address.ts`, `src/lib/shipping-address.test.ts`
- Create: `src/cart/store.ts`, `src/cart/store.test.ts`, `src/cart/useCart.ts`

**Interfaces (later tasks import these exact names):**
- `formatCents(cents: number): string` — `2900 → "$29.00"`, always two decimals, USD.
- `normalizeShippingAddress(input: unknown): NormalizedAddress | null` where `NormalizedAddress = { name?: string; line1: string; line2?: string; city: string; state?: string; postalCode: string; country: string }` — accepts Stripe-shaped snake_case (`postal_code`) and saved camelCase (`postalCode`) blobs; returns `null` for null/undefined/malformed (missing line1/city).
- Cart: `type CartLine = { productId: string; slug: string; name: string; priceCents: number; image: string | null; quantity: number; stockQty: number }`. Store API (all exported from `src/cart/store.ts`): `addLine(line: Omit<CartLine, 'quantity'>, qty: number): void` (merges by productId, clamps to `min(stockQty, 99)`, min 1), `setQuantity(productId, qty)` (same clamp), `removeLine(productId)`, `clearCart()`, `updateLineMeta(productId, patch: Partial<Pick<CartLine, 'priceCents' | 'stockQty' | 'name' | 'image'>>)` (re-clamps quantity if stock dropped), `getLines(): CartLine[]`, `subscribe(cb): () => void`, plus pure helpers `subtotalCents(lines): number`, `cartCount(lines): number` (sum of quantities). Persistence: localStorage key `everloom.cart.v1`, JSON `{ lines: CartLine[] }`; corrupted/absent JSON → empty cart; `storage` events from other tabs refresh the snapshot; **SSR-safe** (no window access at import time; `getLines` returns `[]` on server).
- `useCart(): { lines, subtotal, count, hydrated }` from `src/cart/useCart.ts` — client hook over `useSyncExternalStore` with a stable server snapshot (`[]`) so hydration never mismatches; `hydrated` flips true after mount (used to avoid badge flicker).

- [ ] **Step 1: money — failing tests, then implement**

`src/lib/money.test.ts`:

```ts
import { formatCents } from './money';

test.each([
  [2900, '$29.00'],
  [123, '$1.23'],
  [0, '$0.00'],
  [7999, '$79.99'],
  [100000, '$1,000.00'],
])('formatCents(%i) = %s', (cents, out) => {
  expect(formatCents(cents)).toBe(out);
});
```

`src/lib/money.ts`:

```ts
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}
```

- [ ] **Step 2: shipping-address — failing tests, then implement**

`src/lib/shipping-address.test.ts`:

```ts
import { normalizeShippingAddress } from './shipping-address';

test('normalizes Stripe snake_case shape', () => {
  expect(
    normalizeShippingAddress({ name: 'Demo Buyer', line1: '1 Main St', city: 'Berlin', postal_code: '10115', country: 'DE' }),
  ).toEqual({ name: 'Demo Buyer', line1: '1 Main St', city: 'Berlin', postalCode: '10115', country: 'DE' });
});

test('passes through camelCase saved-address shape with optional fields', () => {
  expect(
    normalizeShippingAddress({ label: 'Home', line1: '2 High St', line2: 'Flat 3', city: 'London', state: '', postalCode: 'N1 9GU', country: 'GB' }),
  ).toMatchObject({ line1: '2 High St', line2: 'Flat 3', postalCode: 'N1 9GU' });
});

test.each([null, undefined, 42, 'x', {}, { city: 'Nowhere' }])('malformed input %p → null', (input) => {
  expect(normalizeShippingAddress(input)).toBeNull();
});
```

`src/lib/shipping-address.ts`:

```ts
export type NormalizedAddress = {
  name?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
};

export function normalizeShippingAddress(input: unknown): NormalizedAddress | null {
  if (typeof input !== 'object' || input === null) return null;
  const a = input as Record<string, unknown>;
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;
  const line1 = str(a.line1);
  const city = str(a.city);
  const postalCode = str(a.postalCode) ?? str(a.postal_code);
  const country = str(a.country);
  if (!line1 || !city || !postalCode || !country) return null;
  return {
    name: str(a.name),
    line1,
    line2: str(a.line2),
    city,
    state: str(a.state),
    postalCode,
    country,
  };
}
```

- [ ] **Step 3: cart store — failing tests first**

`src/cart/store.test.ts` (cover: add new / merge duplicate, clamp to stock and 99, setQuantity floor 1, remove, clear, updateLineMeta re-clamps, subtotal/count math, persistence round-trip, corrupted JSON, subscribe fires on mutation). Representative tests — write all of these:

```ts
import { addLine, setQuantity, removeLine, clearCart, updateLineMeta, getLines, subscribe, subtotalCents, cartCount } from './store';

const tee = { productId: 'p1', slug: 'organic-cotton-tee', name: 'Organic Cotton Tee', priceCents: 2900, image: null, stockQty: 40 };
const hoodie = { productId: 'p2', slug: 'heavyweight-hoodie', name: 'Heavyweight Hoodie', priceCents: 7900, image: null, stockQty: 3 };

beforeEach(() => {
  localStorage.clear();
  clearCart();
});

test('addLine adds then merges quantities by productId', () => {
  addLine(tee, 1);
  addLine(tee, 2);
  expect(getLines()).toHaveLength(1);
  expect(getLines()[0].quantity).toBe(3);
});

test('quantity clamps to stockQty', () => {
  addLine(hoodie, 5);
  expect(getLines()[0].quantity).toBe(3);
  setQuantity('p2', 99);
  expect(getLines()[0].quantity).toBe(3);
});

test('setQuantity floors at 1 and removeLine deletes', () => {
  addLine(tee, 2);
  setQuantity('p1', 0);
  expect(getLines()[0].quantity).toBe(1);
  removeLine('p1');
  expect(getLines()).toHaveLength(0);
});

test('updateLineMeta re-clamps when stock drops', () => {
  addLine(tee, 10);
  updateLineMeta('p1', { stockQty: 4, priceCents: 3100 });
  expect(getLines()[0]).toMatchObject({ quantity: 4, priceCents: 3100, stockQty: 4 });
});

test('subtotal and count', () => {
  addLine(tee, 2);
  addLine(hoodie, 1);
  expect(subtotalCents(getLines())).toBe(2 * 2900 + 7900);
  expect(cartCount(getLines())).toBe(3);
});

test('persists to and restores from localStorage', () => {
  addLine(tee, 2);
  expect(JSON.parse(localStorage.getItem('everloom.cart.v1')!).lines).toHaveLength(1);
});

test('corrupted JSON yields empty cart', () => {
  localStorage.setItem('everloom.cart.v1', '{nope');
  expect(getLines()).toEqual([]);
});

test('subscribe notifies on mutation and unsubscribes', () => {
  const cb = vi.fn();
  const off = subscribe(cb);
  addLine(tee, 1);
  expect(cb).toHaveBeenCalled();
  off();
});
```

Run: `npm test` → FAIL (module missing).

- [ ] **Step 4: implement the store**

`src/cart/store.ts`:

```ts
export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  image: string | null;
  quantity: number;
  stockQty: number;
};

const KEY = 'everloom.cart.v1';
const MAX_QTY = 99;
const listeners = new Set<() => void>();
let lines: CartLine[] = load();
const EMPTY: CartLine[] = [];

function load(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '');
    if (typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { lines?: unknown }).lines)) {
      return (parsed as { lines: CartLine[] }).lines;
    }
  } catch {
    /* corrupted or absent — start empty */
  }
  return [];
}

function persist(next: CartLine[]) {
  lines = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(KEY, JSON.stringify({ lines }));
  }
  listeners.forEach((l) => l());
}

const clamp = (qty: number, stockQty: number) => Math.max(1, Math.min(qty, stockQty, MAX_QTY));

export function addLine(line: Omit<CartLine, 'quantity'>, qty: number): void {
  const existing = lines.find((l) => l.productId === line.productId);
  const next = existing
    ? lines.map((l) =>
        l.productId === line.productId
          ? { ...l, ...line, quantity: clamp(l.quantity + qty, line.stockQty) }
          : l,
      )
    : [...lines, { ...line, quantity: clamp(qty, line.stockQty) }];
  persist(next);
}

export function setQuantity(productId: string, qty: number): void {
  persist(lines.map((l) => (l.productId === productId ? { ...l, quantity: clamp(qty, l.stockQty) } : l)));
}

export function removeLine(productId: string): void {
  persist(lines.filter((l) => l.productId !== productId));
}

export function clearCart(): void {
  persist([]);
}

export function updateLineMeta(
  productId: string,
  patch: Partial<Pick<CartLine, 'priceCents' | 'stockQty' | 'name' | 'image'>>,
): void {
  persist(
    lines.map((l) =>
      l.productId === productId
        ? { ...l, ...patch, quantity: clamp(l.quantity, patch.stockQty ?? l.stockQty) }
        : l,
    ),
  );
}

export function getLines(): CartLine[] {
  return typeof window === 'undefined' ? EMPTY : lines;
}

export function getServerLines(): CartLine[] {
  return EMPTY;
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      lines = load();
      listeners.forEach((l) => l());
    }
  });
}

export const subtotalCents = (ls: CartLine[]) => ls.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
export const cartCount = (ls: CartLine[]) => ls.reduce((sum, l) => sum + l.quantity, 0);
```

Note for the jsdom tests: the module caches `lines` at import; `clearCart()` in `beforeEach` resets state — do not rely on re-import.

`src/cart/useCart.ts`:

```ts
'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { cartCount, getLines, getServerLines, subscribe, subtotalCents } from './store';

export function useCart() {
  const lines = useSyncExternalStore(subscribe, getLines, getServerLines);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return { lines, subtotal: subtotalCents(lines), count: cartCount(lines), hydrated };
}
```

`useSyncExternalStore` requires referential stability: `getLines` must return the same array instance between mutations (it does — `lines` module variable), and the server snapshot is the constant `EMPTY`.

- [ ] **Step 5: Run, build, commit**

```bash
npm test        # all green (site + unwrap + money + address + cart)
npm run build   # strict TS clean
git add -A && git commit -m "feat: money formatter, shipping-address normalizer, localStorage cart store (TDD)"
```

### Task 6: Firebase auth — provider, login/signup, interceptors, guard

**Files:**
- Create: `src/auth/firebase.ts`, `src/auth/AuthProvider.tsx`, `src/auth/AuthProvider.test.tsx`, `src/auth/RequireAuth.tsx`, `src/auth/interceptors.ts`
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/components/site/AuthForm.tsx`, `src/components/site/AuthForm.test.tsx`
- Create: `src/app/providers.tsx`
- Modify: `src/app/layout.tsx` (wrap children in `<Providers>`)

**Interfaces:**
- Consumes: `client` from Task 4, shadcn `button/input/label`, `sonner` toaster.
- Produces: `useAuth(): { user: User | null; loading: boolean; signOutUser(): Promise<void> }` (throws outside provider); `<RequireAuth>` client component — while `loading` renders a skeleton, unauthenticated → `router.replace('/login?next=' + encodeURIComponent(pathname))`, authenticated renders children; `firebaseErrorMessage(code: string): string` mapping (`auth/invalid-credential` → 'Email or password is incorrect.', `auth/email-already-in-use` → 'An account with this email already exists.', `auth/weak-password` → 'Password must be at least 6 characters.', fallback 'Something went wrong. Try again.'); `<Providers>` = QueryClientProvider (retry 1, staleTime 10s) + AuthProvider + `<Toaster richColors />`.
- Side effects: importing `src/auth/interceptors.ts` (from AuthProvider module scope, client-only) registers on the shared hey-api `client`: request interceptor adds `Authorization: Bearer <await user.getIdToken()>` when `auth.currentUser` exists; response interceptor calls `signOut(auth)` on 401. Mirrors `../ecommerce-admin/src/api/client.ts`.

- [ ] **Step 1: firebase init + emulator wiring**

`src/auth/firebase.ts`:

```ts
import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

const app =
  getApps()[0] ??
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });

export const auth = getAuth(app);

if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' && typeof window !== 'undefined') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9098', { disableWarnings: true });
}
```

```bash
npm i firebase@12
```

- [ ] **Step 2: AuthProvider (TDD — port the admin tests including the token-refresh-rejection case)**

`src/auth/AuthProvider.test.tsx`: mock `firebase/auth` (`onAuthStateChanged` capture + trigger) exactly as `../ecommerce-admin/src/auth/AuthProvider.test.tsx` does; assert: loading → user set → `loading:false`; signed-out → `user:null`; **rejection path**: if any token/user processing promise rejects, provider still lands on `loading:false` (Phase 2's hang bug — keep the regression test). No admin-claim logic in the storefront provider (simpler than admin: no `getIdTokenResult` needed — subscribe and set state synchronously; keep the try/catch around `signOut`).

`src/auth/AuthProvider.tsx`:

```tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';
import './interceptors';

type AuthState = { user: User | null; loading: boolean; signOutUser: () => Promise<void> };
const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ user: User | null; loading: boolean }>({ user: null, loading: true });

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        setState({ user, loading: false });
      }),
    [],
  );

  const signOutUser = async () => {
    await signOut(auth);
  };

  return <AuthContext.Provider value={{ ...state, signOutUser }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

`src/auth/interceptors.ts`:

```ts
import { signOut } from 'firebase/auth';
import { client } from '@/api/client';
import { auth } from './firebase';

client.interceptors.request.use(async (request) => {
  const user = auth.currentUser;
  if (user) {
    request.headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  }
  return request;
});

client.interceptors.response.use(async (response) => {
  if (response.status === 401 && auth.currentUser) {
    await signOut(auth);
  }
  return response;
});
```

(Match the actual interceptor API of the generated client — check `../ecommerce-admin/src/api/client.ts` and copy its mechanism verbatim.)

- [ ] **Step 3: Providers + layout wiring**

`src/app/providers.tsx`:

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/auth/AuthProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 10_000 } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

```bash
npm i @tanstack/react-query@5
```

Wrap in `src/app/layout.tsx`: `<body …><Providers>{children}</Providers></body>`.

- [ ] **Step 4: AuthForm + login/signup pages (TDD on validation + error mapping)**

`src/components/site/AuthForm.tsx` — one client component, `mode: 'login' | 'signup'` prop: RHF + zod (`email` valid, `password` min 6), submit calls `signInWithEmailAndPassword` / `createUserWithEmailAndPassword`, maps Firebase error codes via `firebaseErrorMessage` (export it from this file), on success `router.replace(next)` where `next` comes from `useSearchParams().get('next') ?? '/'` (reject external URLs: only allow values starting with `/`). Render: display-font heading ('Sign in' / 'Create account'), fields with labels, inline field errors, submit button (`Sign in` / `Create account`), swap link between the two pages preserving `?next=`, and the selvedge stripe under the heading.

`src/components/site/AuthForm.test.tsx`: invalid email shows message; short password shows message; mocked `signInWithEmailAndPassword` rejecting `{ code: 'auth/invalid-credential' }` renders 'Email or password is incorrect.'; successful signup calls `createUserWithEmailAndPassword` and navigates (mock `next/navigation`).

Pages `src/app/(auth)/login/page.tsx` and `signup/page.tsx`: server components rendering `<AuthForm mode="…" />` inside a centered `<main>`; wrap the client component in `<Suspense>` (`useSearchParams` requirement).

- [ ] **Step 5: RequireAuth**

`src/auth/RequireAuth.tsx`:

```tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from './AuthProvider';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, pathname, router]);

  if (loading) return <Skeleton className="mx-auto mt-24 h-40 w-full max-w-xl" />;
  if (!user) return null;
  return <>{children}</>;
}
```

- [ ] **Step 6: Verify end-to-end against the emulator (manual)**

Services up (emulators from ecommerce-admin, API on 3002, `npm run dev`). Visit `/signup`, create `shopper@example.com` / `password123`, expect redirect to `/`. `/login` with wrong password shows 'Email or password is incorrect.'.

- [ ] **Step 7: Test suite, build, commit**

```bash
npm test && npm run build
git add -A && git commit -m "feat: Firebase auth (emulator) — provider, interceptors, login/signup, RequireAuth"
```

### Task 7: Site chrome + home page

**Files:**
- Create: `src/components/site/Header.tsx`, `src/components/site/CartBadge.tsx`, `src/components/site/SearchBox.tsx`, `src/components/site/Footer.tsx`, `src/components/site/UspStrip.tsx`, `src/components/site/ProductCard.tsx`, `src/components/site/Price.tsx`, `src/components/site/RatingStars.tsx`, `src/components/site/ProductCard.test.tsx`, `src/components/site/RatingStars.test.tsx`
- Create: `src/app/(store)/layout.tsx`, `src/app/(store)/page.tsx`, `src/app/(store)/loading.tsx`
- Delete: `src/app/page.tsx` (placeholder moves into the `(store)` group)

**Interfaces:**
- Consumes: `SITE`, `formatCents`, `useCart`, generated SDK (`categoriesControllerFindAll`, `productsControllerFindAll`), `serverFetchOptions`, `unwrap`.
- Produces: `<ProductCard product={ProductResponseDto} />` — links to `/products/[slug]`, shows first image (`next/image`, 3:4 aspect ratio, `sizes="(max-width: 768px) 50vw, 25vw"`), name, `<Price cents />` (mono font), `<RatingStars rating={averageRating} count={reviewCount} />`, badges: `stockQty === 0` → mono `OUT OF STOCK` (ink on flax), `1 ≤ stockQty ≤ 5` → mono `LOW STOCK` (madder). `<Price cents={number} className? />` renders `formatCents` in `font-mono`. `<RatingStars>` renders `★★★★☆`-style glyphs with `aria-label="4.3 out of 5, 12 reviews"`, renders nothing when `rating` is null. Store layout `(store)/layout.tsx` = Header + `<main>{children}</main>` + Footer (auth/checkout/account routes get their own minimal groups — Header appears on store pages; `(auth)` pages render standalone).
- Header: logo (display font, links `/`), nav `Shop → /products`, `About → /about`, `FAQ → /faq`; `<SearchBox>` (form GET → `/products?q=…`); account icon → `/account` (or `/login` if signed out — plain link to `/account`, RequireAuth handles the bounce); `<CartBadge>` client island (cart icon + count from `useCart`, hidden until `hydrated`, links `/cart`). Selvedge stripe as the header's bottom border.
- Footer: USP strip (three items from `SITE.usps`, lucide icons `Clock`, `Undo2`, `Leaf`), link columns (Shop / Help: FAQ, Shipping & returns, Contact / About), contact email, and the brand marquee — a full-width row repeating `EVERLOOM ✳` in display font, CSS `@keyframes marquee` translateX loop, `animation-play-state: paused` under `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 1: Pure components with tests first**

Write failing tests `RatingStars.test.tsx` (renders aria-label and correct filled count for 4.33; null rating renders nothing) and `ProductCard.test.tsx` (name, `$29.00`, link href `/products/organic-cotton-tee`, LOW STOCK badge at stockQty 3, OUT OF STOCK at 0, no badge at 40 — build a `ProductResponseDto` fixture inline). Run → FAIL. Implement `Price`, `RatingStars`, `ProductCard` → PASS.

`RatingStars` core:

```tsx
export function RatingStars({ rating, count }: { rating: number | null; count?: number }) {
  if (rating === null) return null;
  const filled = Math.round(rating);
  return (
    <span
      className="font-mono text-xs text-ink/70"
      aria-label={`${rating.toFixed(1)} out of 5${count !== undefined ? `, ${count} review${count === 1 ? '' : 's'}` : ''}`}
    >
      <span aria-hidden>{'★'.repeat(filled)}{'☆'.repeat(5 - filled)}</span>
      {count !== undefined && <span aria-hidden> ({count})</span>}
    </span>
  );
}
```

- [ ] **Step 2: Header, Footer, layout group**

Move store pages into a route group so chrome applies: `src/app/(store)/layout.tsx` renders `<Header />` + `{children}` + `<Footer />`. Header/CartBadge/SearchBox per Interfaces. Marquee CSS goes in `globals.css`:

```css
@keyframes marquee {
  to { transform: translateX(-50%); }
}
.marquee-track {
  display: inline-flex;
  white-space: nowrap;
  animation: marquee 30s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .marquee-track { animation-play-state: paused; }
}
```

(Duplicate the content span twice inside the track so the -50% loop is seamless.)

- [ ] **Step 3: Home page (server component)**

`src/app/(store)/page.tsx`:

- Fetch in parallel: `categoriesControllerFindAll` and `productsControllerFindAll({ query: { pageSize: 8, sort: 'newest' } })`, both via `unwrap` + `serverFetchOptions`.
- **Hero** (flax panel): left — display-font headline `Basics you'll wear out before they wear down.` + tagline + `Shop all` button (indigo, → `/products`); right — collage of the first 3 product images (stacked/offset `next/image`s). Selvedge stripe under the hero.
- **Category tiles**: one tile per category (name + product-count-free; links `/products?category=<slug>`), flax background, display font.
- **New arrivals**: mono eyebrow `NEW ARRIVALS` + grid of 8 `<ProductCard>`s (2-col mobile / 4-col desktop).
- **USP strip** above the footer.
- `loading.tsx`: skeleton grid.

- [ ] **Step 4: Visual check + tests + commit**

Manual: `npm run dev`, check home at 375px and 1280px widths (grid collapses, focus rings visible, marquee pauses with reduced motion in devtools).

```bash
npm test && npm run build
git add -A && git commit -m "feat: site chrome (header/footer/selvedge/marquee) and home page"
```

### Task 8: Product listing page (`/products`)

**Files:**
- Create: `src/app/(store)/products/page.tsx`, `src/app/(store)/products/loading.tsx`
- Create: `src/components/site/ListingControls.tsx`, `src/components/site/Pagination.tsx`, `src/components/site/Pagination.test.tsx`

**Interfaces:**
- Consumes: `productsControllerFindAll`, `categoriesControllerFindAll`, `ProductCard`, `serverFetchOptions`, `unwrap`.
- Produces: URL contract other tasks link to — `/products?category=<slug>&q=<text>&sort=newest|price_asc|price_desc&page=N`. Page size fixed at 12 (API default). `<Pagination page total pageSize basePath searchParams />` renders Prev/Next + `Page N of M` (mono), preserving other params; returns null when one page.

- [ ] **Step 1: Page (server component, searchParams-driven)**

`page.tsx` (Next 15: `searchParams` is a Promise — `const params = await searchParams`):

- Parse `category`, `q`, `sort` (whitelist to the three values, default `newest`), `page` (int ≥ 1, default 1; `Number.isNaN` → 1).
- Parallel fetch categories + products with those query params.
- Render: h1 (display font): category name if filtering (look up by slug; unknown slug → `notFound()`), else `Shop all` / `Results for "q"` when searching; mono result count `{total} PRODUCTS`.
- `<ListingControls>` (client): category pills (`All` + one per category — links, current pill inverted ink-on-cotton→cotton-on-ink), sort `<Select>` from shadcn navigating via `router.push` with updated param (reset `page`), preserving `q`.
- Grid of `<ProductCard>`; empty state: `No products match. Try clearing the search or picking another category.` with a `Clear filters` link → `/products`.
- `<Pagination>` at the bottom.
- `export const metadata = { title: 'Shop' }`.

- [ ] **Step 2: Pagination (TDD)**

Test first: `page=1 of 3` → Prev disabled, Next href `/products?page=2` (preserves `category=tees`); middle page → both enabled; single page → renders null. Implement as a server-compatible component (plain links, no hooks).

- [ ] **Step 3: Verify against seeded API (manual)**

With services up: `/products` shows 11 active products across 2 pages; `?category=tees` shows 4 (incl. out-of-stock pocket tee with badge); `?q=hoodie` finds 2; `sort=price_asc` puts Everyday Tote first. Header SearchBox submits to this page.

```bash
npm test && npm run build
git add -A && git commit -m "feat: product listing with category/search/sort/pagination"
```

### Task 9: Product detail page (`/products/[slug]`)

**Files:**
- Create: `src/app/(store)/products/[slug]/page.tsx`, `src/app/(store)/products/[slug]/loading.tsx`
- Create: `src/components/site/Gallery.tsx`, `src/components/site/AddToCart.tsx`, `src/components/site/AddToCart.test.tsx`, `src/components/site/StockLine.tsx`, `src/components/site/StockLine.test.tsx`, `src/components/site/RelatedProducts.tsx`

**Interfaces:**
- Consumes: `productsControllerFindBySlug` (404 → `notFound()`), `productsControllerFindAll` (related), `addLine` + `useCart` from Task 5, `formatCents`, `RatingStars`, shadcn `accordion`, `sonner` toast.
- Produces: `<AddToCart product />` client island — qty selector (−/+, clamped 1..min(stockQty,99)) + `Add to cart` button; disabled with mono `OUT OF STOCK` label when `stockQty === 0`; on click `addLine({productId: product.id, slug, name, priceCents, image: images[0] ?? null, stockQty}, qty)` + `toast.success('Added to cart')`. `<StockLine stockQty />`: `stockQty===0` → `Out of stock` (madder), `≤5` → `Only N left` (madder mono), else `In stock` (ink/60). Reviews section is Task 10 — leave a `{/* reviews: task 10 */}` placeholder region after the accordions.

- [ ] **Step 1: TDD the islands**

`StockLine.test.tsx`: three states render the exact strings above. `AddToCart.test.tsx`: stepper clamps at stock 3 (click + at 3 stays 3); disabled at stock 0; clicking Add calls the store (spy on `addLine` via `vi.mock('@/cart/store')`) with quantity 2 after one `+` click. Write tests → FAIL → implement → PASS.

- [ ] **Step 2: Page assembly (server component)**

`page.tsx`:

```
const { slug } = await params;                       // Next 15 params Promise
let product; try { product = await unwrap(...findBySlug) } catch (e) { if ((e as ApiError).status === 404) notFound(); throw e; }
related = unwrap(findAll({ query: { category: product.category?.slug, pageSize: 5 } }))
          → filter(p => p.id !== product.id).slice(0, 4)
```

Two-column ≥`md` (gallery | `md:sticky md:top-8` info column), stacked on mobile:

- `<Gallery images alt={name} />` (client): main `next/image` (3:4, `priority`) + thumbnail row; selected-index state; thumbs are buttons with `aria-label="View image N"`.
- Info column: category link (mono eyebrow, → `/products?category=…`), h1 display font, `<Price>` (large), `<RatingStars>` linking to `#reviews`, `<StockLine>`, description paragraph, `<AddToCart>`.
- Accordions (shadcn, two items): **Details** — description + `100% GOTS-certified organic cotton. Machine wash cold, hang dry.`; **Shipping & returns** — `Ships within 48 hours. Free returns for 30 days — see our shipping & returns policy.` linking `/shipping-returns`.
- `<RelatedProducts>`: mono eyebrow `YOU MAY ALSO LIKE`, 4 `<ProductCard>`s; hidden entirely when empty.
- `generateMetadata`: `{ title: product.name, description: first 160 chars of description }`; 404 case falls through to `notFound()`.

- [ ] **Step 3: Manual verify + commit**

`/products/heavyweight-hoodie`: gallery thumbs switch, `Only 3 left`, stepper clamps at 3, add twice → badge shows 3 (merged, clamped), toast fires. `/products/pocket-tee-madder`: button disabled. `/products/nope`: 404 page.

```bash
npm test && npm run build
git add -A && git commit -m "feat: product detail — gallery, sticky buy column, accordions, related products"
```

### Task 10: Reviews — display + purchase-gated write form

**Files:**
- Create: `src/components/site/Reviews.tsx` (server), `src/components/site/ReviewForm.tsx` (client), `src/components/site/ReviewForm.test.tsx`
- Modify: `src/app/(store)/products/[slug]/page.tsx` (replace the Task 9 placeholder with `<Reviews productId={product.id} />`)

**Interfaces:**
- Consumes: `reviewsControllerList` (public), `reviewsControllerCreate` (auth'd, 403 not-purchased / 409 duplicate / 401), `useAuth`, `unwrap`, `RatingStars`, RHF + zod, `router.refresh()`.
- Produces: `<Reviews productId />` — anchor `id="reviews"`, mono eyebrow `REVIEWS`, aggregate line (`RatingStars` + `4.3 · 3 reviews` or `No reviews yet`), list (rating stars, text, date via `toLocaleDateString('en-US')`, reviewer shown as `Verified buyer` — API exposes only userId, never render it), then `<ReviewForm productId />`.
- ReviewForm states: signed-out → single button `Sign in to review` linking `/login?next=/products/<slug>` (pass `slug` prop through); signed-in → star-picker (5 radio buttons, mono labels) + textarea (zod: rating 1–5 int required, text 1–2000 chars) + `Submit review`. Error mapping by `ApiError.status`: 403 → inline `Only verified buyers can review this product.`; 409 → `You've already reviewed this product.`; else toast. Success → `toast.success('Review published')` + reset + `router.refresh()` (re-renders the RSC list).

- [ ] **Step 1: TDD ReviewForm**

Tests (mock `@/auth/AuthProvider` `useAuth`, mock generated SDK): signed-out renders sign-in link with correct `next`; signed-in submit with no rating shows validation error; SDK rejecting `ApiError(403)` renders the verified-buyers line; success calls `router.refresh` (mock `next/navigation`). FAIL → implement → PASS.

- [ ] **Step 2: Wire into the page, verify manually**

Seeded: tee shows 3 reviews avg 4.3; hoodie 1 review. Signed-out → sign-in link. Signed in as fresh `shopper@example.com` (no purchases) → submit → 403 inline line renders. (`demo-buyer-uid` has no emulator credentials — the positive path is covered by the mocked-success unit test and by API e2e from Phase 1; note this in the task report.)

```bash
npm test && npm run build
git add -A && git commit -m "feat: product reviews — aggregate, list, purchase-gated review form"
```

### Task 11: Cart page + checkout initiation

**Files:**
- Create: `src/app/(store)/cart/page.tsx`, `src/components/site/QtyStepper.tsx`, `src/components/site/CartLineRow.tsx`, `src/components/site/CartSummary.tsx`, `src/components/site/cart-refresh.ts`, `src/components/site/cart-refresh.test.ts`, `src/components/site/CheckoutButton.tsx`, `src/components/site/CheckoutButton.test.tsx`

**Interfaces:**
- Consumes: cart store (Task 5 full API), `productsControllerFindBySlug`, `checkoutControllerCreate`, `useAuth`, `unwrap`/`ApiError`, `formatCents`, TanStack `useMutation`.
- Produces: `refreshCartLines(lines: CartLine[], fetchBySlug: (slug: string) => Promise<ProductResponseDto>): Promise<{ updates: Array<{ productId: string; patch: Parameters<typeof updateLineMeta>[1] }>; unavailable: string[] }>` — pure, testable: fetches each line's product (`Promise.allSettled`), rejected-with-404 → productId listed `unavailable` (page removes those lines and toasts `Some items are no longer available and were removed.`), fulfilled → patch of `{priceCents, stockQty, name, image}` when drifted. Other failures (network) → no-op for that line.
- Page behavior: `useEffect` on mount → `refreshCartLines` → apply `updateLineMeta`/`removeLine`. Rows: image, name (links to product), `<Price>` unit price, stepper (same clamp semantics — reuse the AddToCart stepper by extracting `<QtyStepper value onChange max />` into `src/components/site/QtyStepper.tsx` in this task and refactoring AddToCart to use it), line total, remove button (`aria-label="Remove <name>"`). Warning under a row when `quantity === stockQty && stockQty <= 5`: mono madder `Only N left`. Summary: subtotal, note `Shipping and any discounts are calculated at checkout.`, `<CheckoutButton lines />`. Empty state: `Your cart is empty.` + `Continue shopping` → `/products`.
- CheckoutButton: signed-out → `router.push('/login?next=/cart')`; signed-in → `useMutation` POST `{ items: lines.map(l => ({ productId: l.productId, quantity: l.quantity })) }` → success `window.location.assign(url)`; `ApiError` 409 → `toast.error(message)` (the API's "Only N left of X" / duplicate-merge text) then re-run the refresh; 404 → same toast+refresh; other → `toast.error('Checkout failed. Try again.')`. Button label `Checkout`, disabled while pending or cart empty.

- [ ] **Step 1: TDD `refreshCartLines`** (pure function, fake `fetchBySlug`): price drift patches; stock drop patches; 404 → unavailable; network reject → untouched. FAIL → implement → PASS.

- [ ] **Step 2: TDD CheckoutButton** (mock auth + SDK + `window.location.assign` via `vi.stubGlobal`): signed-out redirects to login; success assigns Stripe URL; 409 toasts exact API message. FAIL → implement → PASS.

- [ ] **Step 3: Assemble page, manual verify**

Add hoodie (qty 3) + tote: rows render, stepper clamped, `Only 3 left` warning visible, subtotal correct. In another terminal deactivate nothing — instead PATCH price via admin API or re-seed variant is overkill: trust unit tests for drift; manually verify the 409 path by setting hoodie qty 3, then in `psql` `UPDATE "Product" SET "stockQty" = 1 WHERE slug = 'heavyweight-hoodie';` → reload cart → stepper clamps to 1 and warning shows. Restore stock to 3 afterwards (or re-run `npm run seed:demo`). Checkout with placeholder Stripe key → clean error toast, no navigation, cart intact.

```bash
npm test && npm run build
git add -A && git commit -m "feat: cart page — stock/price refresh, steppers, checkout initiation"
```

### Task 12: Checkout success page

**Files:**
- Create: `src/app/(store)/checkout/success/page.tsx` (server shell + Suspense), `src/components/site/SuccessStates.tsx` (client), `src/components/site/success-poll.ts`, `src/components/site/success-poll.test.ts`

**Interfaces:**
- Consumes: `ordersControllerFindMine`, `clearCart`, `useAuth`, `unwrap`, `formatCents`, `normalizeShippingAddress`, `RatingStars` not needed here.
- Produces: `pollForOrder(fetchMine: () => Promise<OrderResponseDto[]>, sessionId: string, opts: { intervalMs: number; timeoutMs: number; sleep?: (ms) => Promise<void> }): Promise<{ state: 'paid' | 'pending-timeout' | 'not-found'; order?: OrderResponseDto }>` — pure/injectable: loops `fetchMine`, matches `stripeSessionId === sessionId`; match with status `PAID`(or later: SHIPPED/DELIVERED) → `paid`; match still `PENDING` at timeout → `pending-timeout`; no match at timeout → `not-found`.
- Page behavior (client component under Suspense): read `session_id` from `useSearchParams` (absent → redirect `/`); `clearCart()` once on mount (payment finished at Stripe); signed-out → `Sign in to see your order` link `/login?next=/checkout/success?session_id=…` (encoded); else run `pollForOrder` with `{intervalMs: 2000, timeoutMs: 60000}`. States: polling → `Payment received — confirming your order…` + spinner; `paid` → selvedge stripe, display-font `Thank you`, order id (mono), line items with `<Price>`, subtotal/total, normalized shipping address block, `View your orders` → `/account/orders`; `pending-timeout` → `Your payment is confirmed with Stripe; the order is still processing. It will appear in your orders shortly.` + same link; `not-found` → same reassurance copy (webhook latency) — never an error tone.

- [ ] **Step 1: TDD `pollForOrder`** with injected `sleep` (no fake timers needed): immediate PAID match; PENDING→PAID on third poll; timeout while PENDING → `pending-timeout`; never-appears → `not-found`. FAIL → implement → PASS.

- [ ] **Step 2: Page + manual verify**

Without real Stripe keys the redirect never happens naturally: verify by visiting `/checkout/success?session_id=cs_demo_1` while signed in — seeded demo orders belong to `demo-buyer-uid`, so expect the polling → `not-found` reassurance state after timeout (drop `timeoutMs` via a `NEXT_PUBLIC_SUCCESS_TIMEOUT_MS` env default 60000 to keep the manual check quick). Also verify cart cleared (badge 0) and signed-out state renders the sign-in link.

```bash
npm test && npm run build
git add -A && git commit -m "feat: checkout success page with order polling states"
```

### Task 13: Account area — profile, saved addresses, order history

**Files:**
- Create: `src/app/(store)/account/layout.tsx`, `src/app/(store)/account/page.tsx`, `src/app/(store)/account/orders/page.tsx`, `src/app/(store)/account/orders/[id]/page.tsx`
- Create: `src/api/hooks/account.ts`, `src/components/site/AddressManager.tsx`, `src/components/site/AddressManager.test.tsx`, `src/components/site/OrderStatusBadge.tsx`, `src/components/site/OrderStatusBadge.test.tsx`, `src/components/site/OrderCard.tsx`

**Interfaces:**
- Consumes: `RequireAuth`, `useAuth`, generated SDK (`usersControllerMe`, `usersControllerUpdateAddresses`, `ordersControllerFindMine`, `ordersControllerFindOne`), `AddressDto` type, `normalizeShippingAddress`, `formatCents`, TanStack Query, RHF + zod, shadcn `dialog`.
- Produces: hooks in `src/api/hooks/account.ts` — `useMe()` (query key `['me']`), `useUpdateAddresses()` (mutation PUTting the **whole array**, invalidates `['me']`), `useMyOrders()` (key `['orders','me']`), `useOrder(id)` (key `['orders', id]`); all wrap SDK in `unwrap`. `<OrderStatusBadge status={OrderStatus} />` mono badge — PAID/SHIPPED/DELIVERED ink-on-flax, PENDING ink/60 (`Awaiting payment`), CANCELLED ink/40, REFUNDED madder. All six enum values render their title-cased label (`Paid`, `Shipped`, …).
- Account pages are **client components** (auth'd data) inside `layout.tsx` = `<RequireAuth>` + h1 `Account` + tab nav (`Profile` → `/account`, `Orders` → `/account/orders`) + `{children}`.
- AddressManager: renders `me.addresses` as cards (label, formatted lines); `Add address` / per-card `Edit` open a shadcn Dialog with RHF+zod form — fields exactly `AddressDto`: `label?`, `line1*`, `line2?`, `city*`, `state?`, `postalCode*`, `country*` (2-letter uppercase, zod `z.string().length(2)` + `.toUpperCase()` transform); per-card `Delete` with confirm. Every mutation computes the next full array client-side and calls `useUpdateAddresses` once. Empty state: `No saved addresses yet. Add one to speed up future orders.` (Stripe still collects shipping at checkout in v1 — addresses are a convenience book.)

- [ ] **Step 1: TDD OrderStatusBadge + AddressManager**

Badge test: all six statuses render expected label/class. AddressManager tests (mock hooks module): renders two address cards from `useMe` data; add-flow submits whole array of length 3 (assert mutation payload); delete confirms then submits array of length 1; country field rejects `USA` (validation message `Use a 2-letter country code`). FAIL → implement → PASS.

- [ ] **Step 2: Pages**

- `/account`: email (mono), member-since (`createdAt` from `useMe`), `Sign out` button (`signOutUser` then `router.push('/')`), `<AddressManager />`.
- `/account/orders`: `useMyOrders`; `<OrderCard>` per order — mono short id (`#` + first 8 chars), date, `<OrderStatusBadge>`, item count, `<Price cents={totalCents ?? subtotalCents} />`, links detail. Empty: `No orders yet.` + `Start shopping` → `/products`.
- `/account/orders/[id]`: `useOrder(id)` (client page reading `useParams`); items (name snapshot, qty × unit `<Price>`, line total), subtotal + total rows, shipping address via `normalizeShippingAddress` (null → `Shipping address unavailable` — PENDING orders have none), `<OrderStatusBadge>`, created date. `ApiError` 403/404 → `notFound()` equivalent: render the store 404 copy inline with a back link.

- [ ] **Step 3: Manual verify**

Signed in as `shopper@example.com`: profile shows email; add two addresses, edit one, delete one — reload and they persist (PUT round-trip). Orders list empty-state renders (fresh user has none). API-side check: `curl -s -H "Authorization: Bearer $(<emulator token>)" http://localhost:3002/me | jq .addresses` — or simply rely on the UI reload. (Demo orders belong to `demo-buyer-uid` which has no login; order-detail rendering incl. both address shapes is covered by unit tests with fixtures.)

```bash
npm test && npm run build
git add -A && git commit -m "feat: account area — profile, saved addresses (whole-array PUT), order history"
```

### Task 14: Static pages, 404, error boundary, polish

**Files:**
- Create: `src/app/(store)/about/page.tsx`, `src/app/(store)/faq/page.tsx`, `src/app/(store)/shipping-returns/page.tsx`, `src/app/(store)/contact/page.tsx`
- Create: `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/(store)/products/[slug]/loading.tsx` (if not already), `src/app/robots.ts`

**Interfaces:**
- Consumes: `SITE`, selvedge class, shadcn `accordion`.
- Produces: static routes linked by Footer/Header/detail-page accordions. All static pages share a prose layout: mono eyebrow, display h1, selvedge, max-w-prose body.

- [ ] **Step 1: Write the pages (real copy, brand voice — plain, specific):**

- **About**: 3 short paragraphs on Everloom: what it makes (organic cotton basics), how it thinks about durability ("we'd rather sell you one hoodie that lasts five years"), where materials come from (GOTS-certified cotton). Use `SITE.name` from config, never the literal string.
- **FAQ** (accordion, 6 items, write full answers): What sizes do you carry? · How long does shipping take? (ships in 48h, 3–5 business days US, 5–8 Europe) · What's your return policy? (30 days, free, unworn) · Do you ship to my country? (US, UK + most of Western Europe: DE FR NL ES IT IE AT BE — mirror the API's Stripe allowlist) · How do I use a discount code? (at Stripe checkout) · How do I track my order? (status in Account → Orders; Paid → Shipped → Delivered).
- **Shipping & returns**: two sections with the same facts as FAQ, expanded a paragraph each.
- **Contact**: `SITE.contactEmail` as a `mailto:` link + "We answer within two business days."
- `not-found.tsx`: display-font `Nothing here.`, selvedge, `Back to the shop` → `/products`.
- `error.tsx` (client): `Something went wrong on our side.` + `Try again` button calling `reset()`.
- `robots.ts`: allow all, no sitemap in v1.

- [ ] **Step 2: Keyboard/a11y pass (manual)**

Tab through header → search → cards → footer on home and detail pages: focus rings visible (globals.css `:focus-visible`), gallery thumbs and steppers reachable, dialogs trap focus (shadcn default), all images have alt text (product name).

```bash
npm test && npm run build
git add -A && git commit -m "feat: static pages, 404, error boundary, a11y polish"
```

### Task 15: Playwright smoke suite

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`, `e2e/auth-and-checkout.spec.ts`, `e2e/helpers.ts`
- Modify: `package.json` (scripts `e2e`, `e2e:ui`), `.gitignore` (`/test-results`, `/playwright-report`)

**Interfaces:**
- Consumes: running stack (Postgres, API :3002 with seed, emulators :9098, `next dev` :3000) — the suite does NOT boot services (no `webServer` block); README documents the expectation. Env gate: `STRIPE_E2E=1` enables the real-redirect assertion.
- Produces: `npm run e2e` green against the running stack.

- [ ] **Step 1: Setup**

```bash
npm i -D @playwright/test && npx playwright install chromium
```

`playwright.config.ts`: `testDir: 'e2e'`, `use: { baseURL: 'http://localhost:3000' }`, single chromium project, `retries: 0`, `fullyParallel: false` (auth flows share the emulator).

- [ ] **Step 2: `e2e/smoke.spec.ts`**

1. home renders: hero headline visible, ≥8 product cards, footer marquee present.
2. listing: goto `/products?category=tees` → expect 4 cards, `OUT OF STOCK` badge on Pocket Tee; sort `price_asc` on `/products` puts `Everyday Tote` first.
3. detail: goto Heavyweight Hoodie card → `Only 3 left` visible; qty `+` twice then `Add to cart` → cart badge shows `3` (clamped).
4. cart math: `/cart` shows line total `$237.00`, subtotal `$237.00`; stepper `-` → subtotal `$158.00`; remove → empty state.

- [ ] **Step 3: `e2e/auth-and-checkout.spec.ts`**

`helpers.ts`: `uniqueEmail(testInfo)` → `shopper+<testInfo.workerIndex>-<testInfo.repeatEachIndex>-<Date.now()>@example.com` (fine here — this runs in Node, not a workflow script). Flow: signup → lands on `/` signed in (account icon visible); add tote to cart; `/cart` → `Checkout`:
- default: expect a visible error toast within 10s and URL still `/cart` (placeholder Stripe key path — asserts the failure is clean, cart intact).
- `STRIPE_E2E=1`: instead expect navigation to a URL matching `/checkout\.stripe\.com/` within 15s. Do not automate Stripe's hosted page in v1; stop at the redirect. (Full webhook round-trip stays manual with the Stripe CLI.)
Also: `/account` unauthenticated redirects to `/login?next=%2Faccount`.

- [ ] **Step 4: Run and commit**

```bash
npm run e2e   # all green against the running stack
git add -A && git commit -m "test: Playwright smoke — browse, cart math, auth, checkout initiation"
```

### Task 16: README, full manual QA, wrap-up

**Files:**
- Create: `README.md`
- Modify: anything QA shakes out (bugfix commits)

**Interfaces:** Consumes everything; produces the shippable repo.

- [ ] **Step 1: README** — sections: What this is (one paragraph, storefront of the three-repo platform); Prereqs (Node 20+, Docker, Java for emulators, sibling repos); Run locally — the five terminals:

```
1. cd ecommerce-api && docker compose up -d db && npx prisma migrate dev && npm run seed:demo
2. cd ecommerce-admin && npm run emulators          # auth :9098, UI :4001
3. cd ecommerce-api && PORT=3002 npm run start:dev
4. cd ecommerce-storefront && npm run dev            # :3000
5. (optional, real checkout) stripe listen --forward-to localhost:3002/webhooks/stripe
```

plus env setup, test commands (`npm test`, `npm run e2e`), client regeneration (`cd ../ecommerce-api && npm run openapi:emit && cd - && npm run generate:api`), Stripe test-keys note (placeholder keys → checkout fails cleanly by design; set real `sk_test_` + webhook secret in the API `.env` for end-to-end), and the brand-rename pointer (`src/lib/site.ts`).

- [ ] **Step 2: Manual QA checklist (browser-driven, all against seeded stack):**

1. Home: hero, 4 category tiles, 8 new arrivals, marquee, USP strip.
2. Category pill + sort + search flows on /products; pagination Prev/Next.
3. Detail: gallery switch, low-stock line, accordions, related products exclude self.
4. Reviews: aggregates for tee (4.3/3); signed-out CTA; fresh-user 403 inline message.
5. Cart: merge/clamp, stock-drop reclamp (psql UPDATE + reload, then restore), remove, empty state.
6. Checkout with placeholder key: clean toast, no redirect, cart intact.
7. Success page states (`session_id=cs_demo_1` → reassurance; badge cleared).
8. Signup/login/logout round trip incl. `?next=` redirect both ways.
9. Account: addresses add/edit/delete persist across reload; orders empty state.
10. Static pages + 404 + keyboard pass.
11. `npm test`, `npm run build`, `npm run e2e` all green.
12. Both repos: clean `git status`, suites green (`cd ../ecommerce-api && npm test && npm run test:e2e`).

- [ ] **Step 3: Fix what QA finds** (each fix: failing test where feasible → fix → green → commit), then final commit and ledger update.

---

## Dev loop (five terminals)

See Task 16 README block — identical list. Services are shared with Phase 2; the admin SPA (:5174) is not needed for storefront work but harmless.

## Regenerating the API client

`cd ecommerce-api && npm run openapi:emit` then `cd ../ecommerce-storefront && npm run generate:api`. The generated client is committed; regenerate + commit whenever the API contract changes.

## Production notes (Phase 3 does not deploy)

Firebase App Hosting for the Next app; real Firebase project env vars (drop `NEXT_PUBLIC_USE_EMULATORS`); real Stripe keys + webhook endpoint on the deployed API; add Google sign-in button; swap picsum seeds for real product photography; consider ISR (`revalidate: 60`) on catalog pages once stock display tolerance is decided.

