# Dual CAD/USD Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin set an explicit CAD and USD price on every product, let a shopper switch currency on the storefront, and have Stripe charge in the currency the shopper chose.

**Architecture:** Prices are hand-entered per currency — no FX conversion at runtime. `Product` gains a second non-null price column; `Order` gains a `currency` enum that every existing money column is then interpreted against. The storefront keeps the choice in a cookie read by server components, so prices render server-side with no flicker. Checkout re-derives prices from the database, so the client can never influence the amount charged.

**Tech Stack:** NestJS 11 + Prisma 6 + Postgres 17 (API), React 19 + Vite + React Hook Form + zod (admin), Next.js 15 App Router (storefront), Stripe Checkout, Vitest + Jest.

## Global Constraints

- Two currencies only: `CAD` and `USD`. Two shipping countries only: `CA` and `US`.
- Prices are integer cents. Never compute a price from a rate at request time.
- Both product prices are required. `Product.priceUsdCents` is `NOT NULL`.
- `Product.priceCents` keeps its name and means **CAD**. Do not rename it.
- Money display format is exactly `CAD $54.99` and `USD $39.99` — currency code, space, `$`, amount.
- The storefront currency cookie is named `localninja.currency`, values `CAD` or `USD`, default `CAD`.
- No geolocation or `Accept-Language` sniffing. Currency changes only when the shopper switches.
- PERCENT coupons work in both currencies. FIXED coupons are valid on CAD orders only.
- `/admin/stats` needs no changes — it touches no money columns.
- Run `npm run openapi:emit` in `ecommerce-api`, then `npm run generate:api` in **both** `ecommerce-admin` and `ecommerce-storefront`, after any API contract change. The generated clients are committed.
- Never run `next build` while `next dev` is running against the same repo.

**Rollout order is mandatory:** API + migration (Tasks 1–5) → regenerate clients (Task 6) → admin (Tasks 7–9) → storefront (Tasks 10–14). The frontends will not typecheck against the new contract until Task 6.

---

### Task 1: Add the Currency enum and product USD price to the schema

**Files:**
- Modify: `ecommerce-api/prisma/schema.prisma`
- Create: `ecommerce-api/prisma/migrations/<timestamp>_dual_currency/migration.sql` (generated, then hand-edited)

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma model `Product.priceUsdCents: Int`, enum `Currency { CAD USD }`, `Order.currency: Currency`.

- [ ] **Step 1: Edit the schema**

In `ecommerce-api/prisma/schema.prisma`, add the enum next to the other enums:

```prisma
enum Currency {
  CAD
  USD
}
```

In `model Product`, add the USD price directly below `priceCents`:

```prisma
  priceCents    Int // CAD, in cents — the base currency
  priceUsdCents Int // USD, in cents — entered by hand, never converted at runtime
```

In `model Order`, add the currency column below `email`:

```prisma
  currency Currency @default(CAD)
```

- [ ] **Step 2: Create the migration without applying it**

Run:

```bash
cd ecommerce-api && npx prisma migrate dev --name dual_currency --create-only
```

Expected: prints `Prisma Migration created` and writes a new folder under `prisma/migrations/`. It does **not** touch the database yet.

- [ ] **Step 3: Hand-edit the migration so no row is ever null**

Prisma will have generated `ADD COLUMN "priceUsdCents" INTEGER NOT NULL`, which fails on a table with existing rows. Replace the `Product` portion of the generated `migration.sql` with the three-step version:

```sql
-- Step 1: add nullable so existing rows survive
ALTER TABLE "Product" ADD COLUMN "priceUsdCents" INTEGER;

-- Step 2: backfill from CAD at a one-time literal rate, rounded to charm pricing.
-- This literal is deliberately NOT shared with the admin autofill constant: a
-- migration must stay reproducible forever, so it cannot read a value that
-- changes later. These are a starting point for admin to review, not a commitment.
UPDATE "Product"
SET "priceUsdCents" = (FLOOR("priceCents" * 0.73 / 100) * 100) + 99
WHERE "priceUsdCents" IS NULL;

-- Step 3: lock it down
ALTER TABLE "Product" ALTER COLUMN "priceUsdCents" SET NOT NULL;
```

Leave the generated `Currency` enum and `Order."currency"` statements as they are — the enum is new and the column has a default, so both are safe on existing rows.

- [ ] **Step 4: Apply the migration**

Run:

```bash
cd ecommerce-api && npx prisma migrate dev
```

Expected: `The following migration(s) have been applied` and no error.

- [ ] **Step 5: Verify no nulls and sane backfilled values**

Run:

```bash
cd ecommerce-api && npx prisma studio --browser none &
```

Simpler check without Studio — run this and confirm zero rows come back:

```bash
cd ecommerce-api && npx ts-node -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); p.product.findMany({select:{name:true,priceCents:true,priceUsdCents:true}}).then(r=>{console.log(r); console.log('nulls:', r.filter(x=>x.priceUsdCents==null).length); return p.\$disconnect();})"
```

Expected: every row prints a `priceUsdCents` ending in `99`, and `nulls: 0`.

- [ ] **Step 6: Commit**

```bash
git add ecommerce-api/prisma/schema.prisma ecommerce-api/prisma/migrations
git commit -m "Schema: add per-currency product prices and order currency"
```

---

### Task 2: Accept and validate a currency on the checkout DTO

**Files:**
- Modify: `ecommerce-api/src/checkout/dto/create-checkout.dto.ts`
- Test: `ecommerce-api/src/checkout/dto/create-checkout.dto.spec.ts` (create)

**Interfaces:**
- Consumes: `Currency` enum from Task 1 (`@prisma/client`).
- Produces: `CreateCheckoutDto.currency: Currency` — required, validated. Downstream tasks read `dto.currency`.

- [ ] **Step 1: Write the failing test**

Create `ecommerce-api/src/checkout/dto/create-checkout.dto.spec.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCheckoutDto } from './create-checkout.dto';

const base = { items: [{ productId: 'p1', quantity: 1 }] };

async function errorsFor(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateCheckoutDto, payload);
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}).map(() => e.property));
}

describe('CreateCheckoutDto currency', () => {
  it('accepts CAD', async () => {
    expect(await errorsFor({ ...base, currency: 'CAD' })).not.toContain('currency');
  });

  it('accepts USD', async () => {
    expect(await errorsFor({ ...base, currency: 'USD' })).not.toContain('currency');
  });

  it('rejects an unsupported currency', async () => {
    expect(await errorsFor({ ...base, currency: 'EUR' })).toContain('currency');
  });

  it('rejects a missing currency', async () => {
    expect(await errorsFor(base)).toContain('currency');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ecommerce-api && npx jest src/checkout/dto/create-checkout.dto.spec.ts`
Expected: FAIL — the `EUR` and missing cases pass nothing to validate because `currency` does not exist yet.

- [ ] **Step 3: Add the field**

In `ecommerce-api/src/checkout/dto/create-checkout.dto.ts`, add `IsEnum` to the existing `class-validator` import, import the enum, and add the property to `CreateCheckoutDto`:

```ts
import { Currency } from '@prisma/client';
```

```ts
  // Which currency the shopper is buying in. The server picks the matching
  // price column from the database — this only selects the column, it never
  // supplies an amount.
  @IsEnum(Currency)
  currency!: Currency;
```

- [ ] **Step 4: Run the tests**

Run: `cd ecommerce-api && npx jest src/checkout/dto/create-checkout.dto.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add ecommerce-api/src/checkout/dto/create-checkout.dto.ts ecommerce-api/src/checkout/dto/create-checkout.dto.spec.ts
git commit -m "Checkout: accept a validated currency on the session request"
```

---

### Task 3: Reject FIXED coupons on USD carts

**Files:**
- Modify: `ecommerce-api/src/coupons/coupons.service.ts:87` (the `quoteForUser` signature and body)
- Test: `ecommerce-api/src/coupons/coupons.service.spec.ts`

**Interfaces:**
- Consumes: `Currency` from Task 1.
- Produces: `quoteForUser(userId: string, code: string, subtotalCents: number, currency: Currency): Promise<CouponQuote>` — note the **fourth parameter**. Task 4 calls this.

- [ ] **Step 1: Write the failing test**

Add to `ecommerce-api/src/coupons/coupons.service.spec.ts`, inside the existing top-level `describe`:

```ts
  describe('currency rules', () => {
    it('allows a PERCENT coupon on a USD cart', async () => {
      prisma.coupon.findUnique.mockResolvedValue({
        id: 'c1', code: 'TENOFF', type: 'PERCENT', value: 10, active: true,
      });
      prisma.couponRedemption.findUnique.mockResolvedValue(null);

      const quote = await service.quoteForUser('u1', 'TENOFF', 10000, 'USD');

      expect(quote.discountCents).toBe(1000);
    });

    it('rejects a FIXED coupon on a USD cart', async () => {
      prisma.coupon.findUnique.mockResolvedValue({
        id: 'c2', code: 'TENBUCKS', type: 'FIXED', value: 1000, active: true,
      });
      prisma.couponRedemption.findUnique.mockResolvedValue(null);

      await expect(
        service.quoteForUser('u1', 'TENBUCKS', 10000, 'USD'),
      ).rejects.toThrow('This code is valid on CAD orders only');
    });

    it('still allows a FIXED coupon on a CAD cart', async () => {
      prisma.coupon.findUnique.mockResolvedValue({
        id: 'c2', code: 'TENBUCKS', type: 'FIXED', value: 1000, active: true,
      });
      prisma.couponRedemption.findUnique.mockResolvedValue(null);

      const quote = await service.quoteForUser('u1', 'TENBUCKS', 10000, 'CAD');

      expect(quote.discountCents).toBe(1000);
    });
  });
```

If the existing spec's mocks are named differently, match the file's existing style rather than the names above — read the top of the file first.

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ecommerce-api && npx jest src/coupons/coupons.service.spec.ts`
Expected: FAIL — `quoteForUser` takes three parameters, so the FIXED-on-USD case does not throw.

- [ ] **Step 3: Add the currency parameter and the guard**

In `ecommerce-api/src/coupons/coupons.service.ts`, change the signature and add the check immediately after the redemption check, before the discount is computed:

```ts
  async quoteForUser(
    userId: string,
    code: string,
    subtotalCents: number,
    currency: Currency,
  ): Promise<CouponQuote> {
```

```ts
    // A FIXED coupon's `value` is bare cents with no currency of its own, so it
    // only means anything against CAD. PERCENT coupons are proportional and
    // therefore currency-agnostic.
    if (coupon.type === 'FIXED' && currency !== 'CAD') {
      throw new BadRequestException('This code is valid on CAD orders only');
    }
```

Add `Currency` to the `@prisma/client` import and `BadRequestException` to the `@nestjs/common` import.

- [ ] **Step 4: Run the tests**

Run: `cd ecommerce-api && npx jest src/coupons/coupons.service.spec.ts`
Expected: PASS, including the pre-existing tests. Any existing call sites in this spec that pass three arguments must be updated to pass `'CAD'` as the fourth.

- [ ] **Step 5: Commit**

```bash
git add ecommerce-api/src/coupons
git commit -m "Coupons: fixed-amount codes apply to CAD orders only"
```

---

### Task 4: Charge in the requested currency

**Files:**
- Modify: `ecommerce-api/src/checkout/checkout.service.ts:17-20` (constants), and the `createSession` body
- Test: `ecommerce-api/src/checkout/checkout.service.spec.ts`

**Interfaces:**
- Consumes: `dto.currency` (Task 2), `quoteForUser(..., currency)` (Task 3), `product.priceUsdCents` (Task 1).
- Produces: Stripe sessions whose `currency` and `unit_amount` match the request; `Order.currency` persisted.

- [ ] **Step 1: Write the failing test**

Add to `ecommerce-api/src/checkout/checkout.service.spec.ts`:

```ts
  it('builds a USD session from the USD price and stamps the order', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Lamp', priceCents: 5499, priceUsdCents: 3999, stockQty: 10, active: true },
    ]);

    await service.createSession(user, {
      items: [{ productId: 'p1', quantity: 2 }],
      currency: 'USD',
    });

    const session = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(session.line_items[0].price_data.currency).toBe('usd');
    expect(session.line_items[0].price_data.unit_amount).toBe(3999);

    const order = prisma.order.create.mock.calls[0][0].data;
    expect(order.currency).toBe('USD');
    expect(order.subtotalCents).toBe(7998);
    expect(order.items.create[0].priceCents).toBe(3999);
  });

  it('builds a CAD session from the CAD price', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Lamp', priceCents: 5499, priceUsdCents: 3999, stockQty: 10, active: true },
    ]);

    await service.createSession(user, {
      items: [{ productId: 'p1', quantity: 1 }],
      currency: 'CAD',
    });

    const session = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(session.line_items[0].price_data.currency).toBe('cad');
    expect(session.line_items[0].price_data.unit_amount).toBe(5499);
  });

  it('allows a US shipping address', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Lamp', priceCents: 5499, priceUsdCents: 3999, stockQty: 10, active: true },
    ]);

    await service.createSession(user, {
      items: [{ productId: 'p1', quantity: 1 }],
      currency: 'USD',
    });

    const session = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(session.shipping_address_collection.allowed_countries).toEqual(['CA', 'US']);
  });
```

Match the spec file's existing mock/setup names — read its top before writing.

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ecommerce-api && npx jest src/checkout/checkout.service.spec.ts`
Expected: FAIL — currency is hardcoded to `cad` and `allowed_countries` is `['CA']`.

- [ ] **Step 3: Make currency per-request**

In `ecommerce-api/src/checkout/checkout.service.ts`, replace the two module constants at lines 17-20:

```ts
// Canada and the US. Stripe Tax computes the destination's sales tax from the
// address the customer enters on the hosted Checkout page.
const SHIPPING_COUNTRIES = ['CA', 'US'] as const;

// The shopper's chosen currency selects which price column we bill from. Both
// prices are set by hand in admin, so nothing is converted at request time.
const PRICE_COLUMN = {
  CAD: 'priceCents',
  USD: 'priceUsdCents',
} as const satisfies Record<Currency, 'priceCents' | 'priceUsdCents'>;

const unitAmountFor = (
  product: { priceCents: number; priceUsdCents: number },
  currency: Currency,
): number => product[PRICE_COLUMN[currency]];
```

Add `import { Currency } from '@prisma/client';` to the imports.

Inside `createSession`, replace the subtotal calculation:

```ts
    const subtotalCents = lines.reduce(
      (sum, l) => sum + unitAmountFor(l.product, dto.currency) * l.quantity,
      0,
    );
```

Pass the currency through to the coupon quote:

```ts
    const quote = dto.couponCode
      ? await this.coupons.quoteForUser(
          user.uid,
          dto.couponCode,
          subtotalCents,
          dto.currency,
        )
      : null;
```

Stamp the order and snapshot per-currency prices:

```ts
      data: {
        userId: user.uid,
        email: user.email,
        currency: dto.currency,
        subtotalCents,
        couponCode: quote?.coupon.code ?? null,
        discountCents: quote?.discountCents ?? null,
        items: {
          create: lines.map((l) => ({
            productId: l.product.id,
            name: l.product.name,
            priceCents: unitAmountFor(l.product, dto.currency),
            quantity: l.quantity,
          })),
        },
      },
```

Then replace both Stripe currency uses. The ad-hoc coupon:

```ts
                await this.stripe.client.coupons.create({
                  amount_off: quote.discountCents,
                  currency: dto.currency.toLowerCase(),
                  duration: 'once' as const,
                  name: quote.coupon.code,
                })
```

And the line items:

```ts
        line_items: lines.map((l) => ({
          quantity: l.quantity,
          price_data: {
            currency: dto.currency.toLowerCase(),
            unit_amount: unitAmountFor(l.product, dto.currency),
            product_data: { name: l.product.name },
            // Prices are tax-exclusive; Stripe Tax adds the destination tax on top.
            tax_behavior: 'exclusive',
          },
        })),
```

- [ ] **Step 4: Run the tests**

Run: `cd ecommerce-api && npx jest src/checkout`
Expected: PASS. Existing tests that call `createSession` without a currency must be updated to pass `currency: 'CAD'`.

- [ ] **Step 5: Run the whole API suite**

Run: `cd ecommerce-api && npm test`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add ecommerce-api/src/checkout
git commit -m "Checkout: bill in the shopper's currency and ship to CA and US"
```

---

### Task 5: Expose both prices and the order currency on the API contract

**Files:**
- Modify: `ecommerce-api/src/products/dto/product-response.dto.ts` (and `ProductBaseResponseDto` if prices live there)
- Modify: `ecommerce-api/src/products/dto/create-product.dto.ts` and `update-product.dto.ts`
- Modify: `ecommerce-api/src/orders/dto/order-response.dto.ts`

**Interfaces:**
- Produces: `priceUsdCents: number` on product responses and write DTOs; `currency: 'CAD' | 'USD'` on order responses. Tasks 7–14 consume these through the generated clients.

- [ ] **Step 1: Add the field to the product response DTO**

Find the class that declares `priceCents` (grep: `cd ecommerce-api && grep -rn "priceCents" src/products/dto`). Directly below it add:

```ts
  @ApiProperty({ description: 'USD price in cents', example: 3999 })
  priceUsdCents!: number;
```

- [ ] **Step 2: Add it to the write DTOs**

In `create-product.dto.ts`, below the existing `priceCents` property:

```ts
  @ApiProperty({ description: 'USD price in cents', example: 3999 })
  @IsInt()
  @Min(0)
  priceUsdCents!: number;
```

`update-product.dto.ts` is a `PartialType` of the create DTO in this codebase — if so it inherits the field and needs no edit. Verify with `grep -n "PartialType" ecommerce-api/src/products/dto/update-product.dto.ts`; if it is not a `PartialType`, add the same property with `@IsOptional()`.

- [ ] **Step 3: Add currency to the order response DTO**

In `ecommerce-api/src/orders/dto/order-response.dto.ts`, below `email`:

```ts
  @ApiProperty({ enum: ['CAD', 'USD'], description: 'Currency this order was charged in' })
  currency!: 'CAD' | 'USD';
```

- [ ] **Step 4: Build and confirm the contract compiles**

Run: `cd ecommerce-api && npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add ecommerce-api/src/products/dto ecommerce-api/src/orders/dto
git commit -m "API: expose the USD price and the order currency"
```

---

### Task 6: Regenerate both API clients

**Files:**
- Modify: `ecommerce-api/openapi.json`
- Modify: `ecommerce-admin/src/api/generated/**`
- Modify: `ecommerce-storefront/src/api/generated/**`

**Interfaces:**
- Produces: typed `priceUsdCents` and `currency` in both generated clients. Every later task depends on this.

- [ ] **Step 1: Emit the OpenAPI schema**

Run: `cd ecommerce-api && npm run openapi:emit`
Expected: rebuilds and rewrites `openapi.json`.

- [ ] **Step 2: Confirm the new fields landed**

Run: `cd ecommerce-api && grep -c "priceUsdCents" openapi.json`
Expected: a number greater than 0.

- [ ] **Step 3: Regenerate the admin client**

Run: `cd ecommerce-admin && npm run generate:api`
Expected: files under `src/api/generated` change.

- [ ] **Step 4: Regenerate the storefront client**

Run: `cd ecommerce-storefront && npm run generate:api`
Expected: files under `src/api/generated` change.

- [ ] **Step 5: Commit**

```bash
git add ecommerce-api/openapi.json ecommerce-admin/src/api/generated ecommerce-storefront/src/api/generated
git commit -m "Regenerate API clients for dual-currency fields"
```

---

### Task 7: Make admin money formatting currency-aware

**Files:**
- Modify: `ecommerce-admin/src/lib/money.ts`
- Test: `ecommerce-admin/src/lib/money.test.ts`

**Interfaces:**
- Produces: `formatMoney(cents: number, currency: 'CAD' | 'USD'): string` returning `CAD $54.99` / `USD $39.99`. Replaces `formatUsd`. Tasks 8 and 9 use it.

- [ ] **Step 1: Write the failing test**

Replace the `formatUsd` describe block in `ecommerce-admin/src/lib/money.test.ts` with:

```ts
describe('formatMoney', () => {
  it('formats CAD with an explicit code', () => {
    expect(formatMoney(5499, 'CAD')).toBe('CAD $54.99');
  });

  it('formats USD with an explicit code', () => {
    expect(formatMoney(3999, 'USD')).toBe('USD $39.99');
  });

  it('formats zero', () => {
    expect(formatMoney(0, 'CAD')).toBe('CAD $0.00');
  });

  it('groups thousands', () => {
    expect(formatMoney(100000, 'USD')).toBe('USD $1,000.00');
  });
});
```

Update the import at the top of the file to `import { centsToDollars, dollarsToCents, formatMoney } from './money';`.

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ecommerce-admin && npx vitest run src/lib/money.test.ts`
Expected: FAIL — `formatMoney` is not exported.

- [ ] **Step 3: Replace formatUsd**

In `ecommerce-admin/src/lib/money.ts`, delete `formatUsd` and add:

```ts
// Orders are charged in either CAD or USD, so the code is always spelled out —
// a bare "$" is ambiguous between the two currencies the store actually sells in.
export function formatMoney(cents: number, currency: 'CAD' | 'USD'): string {
  const amount = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
  }).format(cents / 100);
  // en-CA renders USD as "US$39.99"; normalise both to a bare "$" so the
  // explicit prefix below is the only currency marker.
  return `${currency} ${amount.replace(/^US\$/, '$').replace(/^CA\$/, '$')}`;
}
```

- [ ] **Step 4: Run the tests**

Run: `cd ecommerce-admin && npx vitest run src/lib/money.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add ecommerce-admin/src/lib/money.ts ecommerce-admin/src/lib/money.test.ts
git commit -m "Admin: format money against an explicit currency"
```

---

### Task 8: Add both price fields and an autofill button to the product form

**Files:**
- Create: `ecommerce-admin/src/lib/fx.ts`
- Modify: `ecommerce-admin/src/pages/products/product-form.tsx`
- Test: `ecommerce-admin/src/pages/products/product-form.test.tsx`

**Interfaces:**
- Consumes: `dollarsToCents`, `centsToDollars` (existing), `priceUsdCents` on the product DTO (Task 6).
- Produces: `suggestUsdFromCad(cadDollars: string): string` in `src/lib/fx.ts`.

- [ ] **Step 1: Write the failing test for the rate helper**

Create `ecommerce-admin/src/lib/fx.test.ts`:

```ts
import { suggestUsdFromCad } from './fx';

describe('suggestUsdFromCad', () => {
  it('converts and rounds up to charm pricing', () => {
    expect(suggestUsdFromCad('54.99')).toBe('39.99');
  });

  it('returns an empty string for an unparseable price', () => {
    expect(suggestUsdFromCad('abc')).toBe('');
  });

  it('returns an empty string for an empty input', () => {
    expect(suggestUsdFromCad('')).toBe('');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ecommerce-admin && npx vitest run src/lib/fx.test.ts`
Expected: FAIL — module `./fx` does not exist.

- [ ] **Step 3: Write the rate helper**

Create `ecommerce-admin/src/lib/fx.ts`:

```ts
import { dollarsToCents } from './money';

// Seeds the "Autofill from CAD" button only. It is a starting suggestion the
// admin edits, never a live conversion — prices are stored per currency and
// nothing recomputes them later. Edit this one number when it drifts too far.
export const CAD_TO_USD = 0.73;

export function suggestUsdFromCad(cadDollars: string): string {
  const cents = dollarsToCents(cadDollars);
  if (cents === null) return '';
  // Charm pricing: land on the next .99 so suggestions look like real prices.
  const usdCents = Math.floor((cents * CAD_TO_USD) / 100) * 100 + 99;
  return (usdCents / 100).toFixed(2);
}
```

- [ ] **Step 4: Run the helper tests**

Run: `cd ecommerce-admin && npx vitest run src/lib/fx.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the failing form test**

Add to `ecommerce-admin/src/pages/products/product-form.test.tsx`:

```tsx
  it('blocks submit when the USD price is empty', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Name'), 'Lamp');
    await user.type(screen.getByLabelText('Price (CAD)'), '54.99');
    await user.click(screen.getByRole('button', { name: /save|create/i }));

    expect(await screen.findByText('Enter a valid price')).toBeInTheDocument();
  });

  it('fills the USD price from CAD when the autofill button is clicked', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Price (CAD)'), '54.99');
    await user.click(screen.getByRole('button', { name: 'Autofill from CAD' }));

    expect(screen.getByLabelText('Price (USD)')).toHaveValue('39.99');
  });
```

Use whatever render helper the file already defines instead of `renderForm()` if it differs — read the top of the file first.

- [ ] **Step 6: Run it to make sure it fails**

Run: `cd ecommerce-admin && npx vitest run src/pages/products/product-form.test.tsx`
Expected: FAIL — there is no "Price (USD)" field or autofill button.

- [ ] **Step 7: Add the second price to the schema and form**

In `product-form.tsx`, rename the `price` field to `priceCad` and add `priceUsd` in `formSchema`:

```ts
  priceCad: z
    .string()
    .refine((v) => dollarsToCents(v) !== null, 'Enter a valid price'),
  priceUsd: z
    .string()
    .refine((v) => dollarsToCents(v) !== null, 'Enter a valid price'),
```

Update the `form.reset` in the edit effect:

```ts
          priceCad: centsToDollars(existing.priceCents),
          priceUsd: centsToDollars(existing.priceUsdCents),
```

Update `onSubmit`:

```ts
      priceCents: dollarsToCents(values.priceCad)!,
      priceUsdCents: dollarsToCents(values.priceUsd)!,
```

Add the import and the autofill handler:

```ts
import { suggestUsdFromCad } from '@/lib/fx';
```

```ts
  function onAutofillUsd() {
    const suggested = suggestUsdFromCad(form.getValues('priceCad'));
    if (suggested) form.setValue('priceUsd', suggested, { shouldValidate: true });
  }
```

Replace the existing price `FormField` block with two fields plus the button. Keep the surrounding markup style of the neighbouring fields:

```tsx
            <FormField
              control={form.control}
              name="priceCad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (CAD)</FormLabel>
                  <FormControl>
                    <Input placeholder="54.99" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priceUsd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (USD)</FormLabel>
                  <FormControl>
                    <Input placeholder="39.99" {...field} />
                  </FormControl>
                  {/* Suggestion only — the admin is expected to review it. */}
                  <Button type="button" variant="outline" onClick={onAutofillUsd}>
                    Autofill from CAD
                  </Button>
                  <FormMessage />
                </FormItem>
              )}
            />
```

Also update any other reference to the old `price` key in this file — grep for `'price'` before finishing.

- [ ] **Step 8: Run the form tests**

Run: `cd ecommerce-admin && npx vitest run src/pages/products/product-form.test.tsx`
Expected: PASS. Existing tests asserting a `Price` label must be updated to `Price (CAD)`, and any test that submits the form must now also fill `Price (USD)`.

- [ ] **Step 9: Commit**

```bash
git add ecommerce-admin/src/lib/fx.ts ecommerce-admin/src/lib/fx.test.ts ecommerce-admin/src/pages/products/product-form.tsx ecommerce-admin/src/pages/products/product-form.test.tsx
git commit -m "Admin: enter both prices, with a one-click USD suggestion"
```

---

### Task 9: Update the remaining admin screens and bulk upload

**Files:**
- Modify: `ecommerce-admin/src/pages/products/index.tsx:130`
- Modify: `ecommerce-admin/src/pages/orders/order-detail.tsx:87`
- Modify: `ecommerce-admin/src/pages/products/bulk-upload-dialog.tsx:70`
- Test: `ecommerce-admin/src/pages/products/bulk-upload-dialog.test.tsx`

**Interfaces:**
- Consumes: `formatMoney` (Task 7), `priceUsdCents` and `order.currency` (Task 6).

- [ ] **Step 1: Write the failing bulk-upload test**

The file exports `validateRow(r, row, categoryNames)` returning a `ParsedRow` that carries either `error` or `item`. Add to `ecommerce-admin/src/pages/products/bulk-upload-dialog.test.tsx`:

```ts
  it('rejects a row with no USD price', () => {
    const r = validateRow(
      { name: 'Naruto Lamp', description: 'cool', price: '49.99', priceUsd: '', stock: '10', category: 'Anime Lamps' },
      1,
      cats,
    );
    expect(r.error).toBe('invalid USD price');
  });

  it('converts both prices to cents', () => {
    const r = validateRow(
      { name: 'Naruto Lamp', description: 'cool', price: '49.99', priceUsd: '36.99', stock: '10', category: 'Anime Lamps' },
      1,
      cats,
    );
    expect(r.item).toMatchObject({ priceCents: 4999, priceUsdCents: 3699 });
  });
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ecommerce-admin && npx vitest run src/pages/products/bulk-upload-dialog.test.tsx`
Expected: FAIL — `priceUsdCents` is not produced and no USD validation exists.

- [ ] **Step 3: Add the USD column to bulk upload**

In `bulk-upload-dialog.tsx`, add the raw value beside the existing `priceStr` at line 47:

```ts
  const priceUsdStr = (r.priceUsd ?? '').trim();
```

Add it to `base` at line 49 so failing rows still echo what was entered:

```ts
  const base = { row, name, category, price: priceStr, priceUsd: priceUsdStr, stock: stockStr };
```

Add the guard immediately after the existing price check at line 54:

```ts
  const priceUsd = Number(priceUsdStr);
  if (priceUsdStr === '' || !Number.isFinite(priceUsd) || priceUsd < 0)
    return { ...base, error: 'invalid USD price' };
```

Add the cents mapping beside line 70:

```ts
      priceCents: Math.round(price * 100),
      priceUsdCents: Math.round(priceUsd * 100),
```

Add `priceUsd` to the `ParsedRow` type's echo fields, add the column to the `SAMPLE_CSV` constant (header and each sample row), and add it to the dialog's on-screen column list.

- [ ] **Step 4: Point the two display screens at formatMoney**

`src/pages/products/index.tsx:130` — products are catalog rows, so show the CAD price:

```tsx
                  <TableCell>{formatMoney(p.priceCents, 'CAD')}</TableCell>
```

`src/pages/orders/order-detail.tsx:87` — an order renders in the currency it was charged:

```tsx
                <span>{formatMoney(item.priceCents * item.quantity, order.currency)}</span>
```

Update both files' imports from `formatUsd` to `formatMoney`, and grep for any remaining `formatUsd` usage: `cd ecommerce-admin && grep -rn "formatUsd" src`. Expected: no results.

- [ ] **Step 5: Run the admin suite and build**

Run: `cd ecommerce-admin && npm test && npm run build`
Expected: all tests pass and the build succeeds.

- [ ] **Step 6: Commit**

```bash
git add ecommerce-admin/src
git commit -m "Admin: dual prices in bulk upload, currency-aware order totals"
```

---

### Task 10: Add currency-aware money formatting to the storefront

**Files:**
- Modify: `ecommerce-storefront/src/lib/money.ts`
- Test: `ecommerce-storefront/src/lib/money.test.ts`

**Interfaces:**
- Produces: `type Currency = 'CAD' | 'USD'` and `formatMoney(cents: number, currency: Currency): string`. Tasks 11–13 consume both.

- [ ] **Step 1: Write the failing test**

Replace `ecommerce-storefront/src/lib/money.test.ts` with:

```ts
import { formatMoney } from './money';

test.each([
  [5499, 'CAD', 'CAD $54.99'],
  [3999, 'USD', 'USD $39.99'],
  [0, 'CAD', 'CAD $0.00'],
  [100000, 'USD', 'USD $1,000.00'],
] as const)('formatMoney(%i, %s) = %s', (cents, currency, out) => {
  expect(formatMoney(cents, currency)).toBe(out);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ecommerce-storefront && npx vitest run src/lib/money.test.ts`
Expected: FAIL — `formatMoney` is not exported.

- [ ] **Step 3: Replace formatCents**

Replace `ecommerce-storefront/src/lib/money.ts` with:

```ts
export type Currency = 'CAD' | 'USD';

// The store sells in two dollar currencies, so a bare "$" is ambiguous — the
// code is always spelled out. Amounts are charged exactly as shown: both prices
// are entered by hand in admin and nothing is converted at request time.
export function formatMoney(cents: number, currency: Currency): string {
  const amount = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(cents / 100);
  // en-CA renders USD as "US$39.99" and CAD as "$54.99" — normalise to a bare
  // "$" so the explicit prefix is the only currency marker.
  return `${currency} ${amount.replace(/^US\$/, '$').replace(/^CA\$/, '$')}`;
}
```

- [ ] **Step 4: Run the tests**

Run: `cd ecommerce-storefront && npx vitest run src/lib/money.test.ts`
Expected: PASS, 4 cases.

- [ ] **Step 5: Commit**

```bash
git add ecommerce-storefront/src/lib/money.ts ecommerce-storefront/src/lib/money.test.ts
git commit -m "Storefront: format money against an explicit currency"
```

---

### Task 11: Read and write the currency cookie

**Files:**
- Create: `ecommerce-storefront/src/lib/currency.ts`
- Create: `ecommerce-storefront/src/lib/currency.test.ts`

**Interfaces:**
- Consumes: `Currency` from Task 10.
- Produces:
  - `CURRENCY_COOKIE = 'localninja.currency'`
  - `parseCurrency(raw: string | undefined): Currency` — defaults to `'CAD'`
  - `priceFor(product: { priceCents: number; priceUsdCents: number }, currency: Currency): number`

- [ ] **Step 1: Write the failing test**

Create `ecommerce-storefront/src/lib/currency.test.ts`:

```ts
import { parseCurrency, priceFor } from './currency';

describe('parseCurrency', () => {
  it('accepts CAD and USD', () => {
    expect(parseCurrency('CAD')).toBe('CAD');
    expect(parseCurrency('USD')).toBe('USD');
  });

  it('defaults to CAD when absent', () => {
    expect(parseCurrency(undefined)).toBe('CAD');
  });

  it('defaults to CAD for an unrecognised value', () => {
    expect(parseCurrency('EUR')).toBe('CAD');
  });
});

describe('priceFor', () => {
  const product = { priceCents: 5499, priceUsdCents: 3999 };

  it('picks the CAD column', () => {
    expect(priceFor(product, 'CAD')).toBe(5499);
  });

  it('picks the USD column', () => {
    expect(priceFor(product, 'USD')).toBe(3999);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ecommerce-storefront && npx vitest run src/lib/currency.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the module**

Create `ecommerce-storefront/src/lib/currency.ts`:

```ts
import type { Currency } from './money';

export const CURRENCY_COOKIE = 'localninja.currency';

// A year — the shopper's choice should survive between visits.
export const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Anything unrecognised falls back to the home currency rather than throwing:
// a stale or hand-edited cookie must never break a page render.
export function parseCurrency(raw: string | undefined): Currency {
  return raw === 'USD' ? 'USD' : 'CAD';
}

// One place decides which column a currency reads, so the eight components that
// render prices cannot drift apart.
export function priceFor(
  product: { priceCents: number; priceUsdCents: number },
  currency: Currency,
): number {
  return currency === 'USD' ? product.priceUsdCents : product.priceCents;
}
```

- [ ] **Step 4: Run the tests**

Run: `cd ecommerce-storefront && npx vitest run src/lib/currency.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add ecommerce-storefront/src/lib/currency.ts ecommerce-storefront/src/lib/currency.test.ts
git commit -m "Storefront: currency cookie parsing and price selection"
```

---

### Task 12: Render prices in the active currency

**Files:**
- Modify: `ecommerce-storefront/src/components/site/Price.tsx`
- Modify: `ecommerce-storefront/src/components/site/ProductCard.tsx`
- Modify: `ecommerce-storefront/src/app/(store)/page.tsx`
- Modify: `ecommerce-storefront/src/app/(store)/products/page.tsx`
- Modify: `ecommerce-storefront/src/app/(store)/products/[slug]/page.tsx`
- Test: `ecommerce-storefront/src/components/site/ProductCard.test.tsx`

**Interfaces:**
- Consumes: `formatMoney` (Task 10), `parseCurrency`, `priceFor`, `CURRENCY_COOKIE` (Task 11).
- Produces: `<Price cents currency />` and `<ProductCard product currency />`.

- [ ] **Step 1: Write the failing test**

In `ecommerce-storefront/src/components/site/ProductCard.test.tsx`, extend the fixture with a USD price and update the price assertion:

```tsx
    priceCents: 2900,
    priceUsdCents: 2100,
```

```tsx
  it('renders the CAD price by default', () => {
    render(<ProductCard product={makeProduct()} currency="CAD" />);
    expect(screen.getByText('CAD $29.00')).toBeInTheDocument();
  });

  it('renders the USD price when USD is active', () => {
    render(<ProductCard product={makeProduct()} currency="USD" />);
    expect(screen.getByText('USD $21.00')).toBeInTheDocument();
  });
```

Every other `render(<ProductCard ... />)` in this file needs `currency="CAD"` added.

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ecommerce-storefront && npx vitest run src/components/site/ProductCard.test.tsx`
Expected: FAIL — `ProductCard` takes no `currency` prop.

- [ ] **Step 3: Thread currency through the components**

`Price.tsx`:

```tsx
import { formatMoney, type Currency } from '@/lib/money';
import { cn } from '@/lib/utils';

export function Price({
  cents,
  currency,
  className,
}: {
  cents: number;
  currency: Currency;
  className?: string;
}) {
  return <span className={cn('font-mono', className)}>{formatMoney(cents, currency)}</span>;
}
```

`ProductCard.tsx` — add the prop and select the price:

```tsx
import { priceFor } from '@/lib/currency';
import type { Currency } from '@/lib/money';
```

```tsx
export function ProductCard({
  product,
  currency,
}: {
  product: ProductResponseDto;
  currency: Currency;
}) {
```

and replace the price render:

```tsx
        <Price cents={priceFor(product, currency)} currency={currency} className="text-sm text-ink/80" />
```

- [ ] **Step 4: Read the cookie in every page that renders prices**

In each of `app/(store)/page.tsx`, `app/(store)/products/page.tsx`, and `app/(store)/products/[slug]/page.tsx`, add at the top of the async component body:

```tsx
import { cookies } from 'next/headers';
import { CURRENCY_COOKIE, parseCurrency, priceFor } from '@/lib/currency';
```

```tsx
  // Reading cookies opts this route into dynamic rendering, which is what stops
  // a cached page from serving the wrong currency's prices.
  const currency = parseCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);
```

Pass `currency={currency}` to every `<ProductCard>` and `<Price>` in those files. On the product detail page the buy-column price becomes:

```tsx
        <Price cents={priceFor(product, currency)} currency={currency} className="text-lg" />
```

- [ ] **Step 5: Run the tests**

Run: `cd ecommerce-storefront && npm test`
Expected: PASS. `ProductRail`, `CartLineRow`, `CartSummary`, `OrderCard`, and `SuccessStates` will also need a `currency` prop threaded — follow the same pattern and update their tests' fixtures with `priceUsdCents`.

- [ ] **Step 6: Commit**

```bash
git add ecommerce-storefront/src
git commit -m "Storefront: render every price in the active currency"
```

---

### Task 13: Add the footer currency switcher

**Files:**
- Create: `ecommerce-storefront/src/components/site/CurrencySwitcher.tsx`
- Create: `ecommerce-storefront/src/components/site/CurrencySwitcher.test.tsx`
- Modify: `ecommerce-storefront/src/components/site/Footer.tsx`

**Interfaces:**
- Consumes: `CURRENCY_COOKIE`, `CURRENCY_COOKIE_MAX_AGE`, `parseCurrency` (Task 11).
- Produces: `<CurrencySwitcher current={Currency} />`.

- [ ] **Step 1: Write the failing test**

Create `ecommerce-storefront/src/components/site/CurrencySwitcher.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

import { CurrencySwitcher } from './CurrencySwitcher';

beforeEach(() => {
  vi.clearAllMocks();
  document.cookie = 'localninja.currency=; max-age=0; path=/';
});

it('writes the chosen currency to the cookie and refreshes', async () => {
  const user = userEvent.setup();
  render(<CurrencySwitcher current="CAD" />);

  await user.click(screen.getByRole('button', { name: 'USD $' }));

  expect(document.cookie).toContain('localninja.currency=USD');
  expect(refreshMock).toHaveBeenCalled();
});

it('marks the active currency as pressed', () => {
  render(<CurrencySwitcher current="USD" />);
  expect(screen.getByRole('button', { name: 'USD $' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'CAD $' })).toHaveAttribute('aria-pressed', 'false');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ecommerce-storefront && npx vitest run src/components/site/CurrencySwitcher.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Write the component**

Create `ecommerce-storefront/src/components/site/CurrencySwitcher.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE } from '@/lib/currency';
import type { Currency } from '@/lib/money';

const OPTIONS: { value: Currency; label: string }[] = [
  { value: 'CAD', label: 'CAD $' },
  { value: 'USD', label: 'USD $' },
];

export function CurrencySwitcher({ current }: { current: Currency }) {
  const router = useRouter();

  function choose(currency: Currency) {
    document.cookie = `${CURRENCY_COOKIE}=${currency}; max-age=${CURRENCY_COOKIE_MAX_AGE}; path=/; samesite=lax`;
    // Prices are server-rendered, so re-fetch rather than converting in the
    // browser — that keeps one source of truth for what a product costs.
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Currency">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => choose(option.value)}
          aria-pressed={current === option.value}
          className={
            current === option.value
              ? 'rounded-full bg-ink px-3 py-1 font-mono text-xs text-surface'
              : 'rounded-full px-3 py-1 font-mono text-xs text-ink/60 hover:text-ink'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Mount it in the footer**

`Footer.tsx` is a server component, so it reads the cookie and passes the value down. Add to its imports:

```tsx
import { cookies } from 'next/headers';
import { CURRENCY_COOKIE, parseCurrency } from '@/lib/currency';
import { CurrencySwitcher } from './CurrencySwitcher';
```

Make the component async and read the cookie:

```tsx
export async function Footer() {
  const currency = parseCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);
```

Render the switcher in the bottom bar, beside the contact email:

```tsx
      <div className="container-wide flex flex-wrap items-center justify-between gap-4 pb-8 text-sm">
        <a href={`mailto:${SITE.contactEmail}`} className="text-ink hover:text-brand">
          {SITE.contactEmail}
        </a>
        <CurrencySwitcher current={currency} />
      </div>
```

- [ ] **Step 5: Run the tests**

Run: `cd ecommerce-storefront && npm test`
Expected: PASS. If a test renders `<Footer />` directly it must now await it or be adapted for an async server component.

- [ ] **Step 6: Commit**

```bash
git add ecommerce-storefront/src/components/site/CurrencySwitcher.tsx ecommerce-storefront/src/components/site/CurrencySwitcher.test.tsx ecommerce-storefront/src/components/site/Footer.tsx
git commit -m "Storefront: footer currency switcher"
```

---

### Task 14: Refresh the cart on a currency change and send it to checkout

**Files:**
- Modify: `ecommerce-storefront/src/cart/store.ts`
- Test: `ecommerce-storefront/src/cart/store.test.ts`
- Modify: the component that posts to `/checkout` (find with `grep -rn "checkoutController" ecommerce-storefront/src --include="*.tsx"`)

**Interfaces:**
- Consumes: `Currency` (Task 10), `priceFor` (Task 11).
- Produces: `getCartCurrency(): Currency | null`, `setCartCurrency(currency: Currency): void` on the cart store.

- [ ] **Step 1: Write the failing test**

Add to `ecommerce-storefront/src/cart/store.test.ts`:

```ts
test('remembers which currency the cart was priced in', () => {
  clearCart();
  addLine(tee, 1);
  setCartCurrency('CAD');
  expect(getCartCurrency()).toBe('CAD');

  setCartCurrency('USD');
  expect(getCartCurrency()).toBe('USD');
});

test('reports no currency for a fresh cart', () => {
  clearCart();
  expect(getCartCurrency()).toBe(null);
});
```

Add `getCartCurrency` and `setCartCurrency` to the file's import list.

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ecommerce-storefront && npx vitest run src/cart/store.test.ts`
Expected: FAIL — those exports do not exist.

- [ ] **Step 3: Persist the cart's currency**

In `ecommerce-storefront/src/cart/store.ts`, add a module-level value and persist it alongside the lines. Change `load`, `persist`, and add the two accessors:

```ts
let cartCurrency: 'CAD' | 'USD' | null = loadCurrency();

function loadCurrency(): 'CAD' | 'USD' | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '');
    const raw = (parsed as { currency?: unknown })?.currency;
    return raw === 'CAD' || raw === 'USD' ? raw : null;
  } catch {
    return null;
  }
}

export function getCartCurrency(): 'CAD' | 'USD' | null {
  return typeof window === 'undefined' ? null : cartCurrency;
}

export function setCartCurrency(currency: 'CAD' | 'USD'): void {
  cartCurrency = currency;
  persist(lines);
}
```

and update `persist` so the currency is written too:

```ts
function persist(next: CartLine[]) {
  lines = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(KEY, JSON.stringify({ lines, currency: cartCurrency }));
  }
  listeners.forEach((l) => l());
}
```

- [ ] **Step 4: Run the cart tests**

Run: `cd ecommerce-storefront && npx vitest run src/cart/store.test.ts`
Expected: PASS, including the file's pre-existing tests.

- [ ] **Step 5: Make the cart refresh currency-aware**

`src/components/site/cart-refresh.ts:34` compares against `product.priceCents`, so in USD mode it would keep overwriting lines with the CAD price. Add a `currency` parameter to both exported functions.

First the failing test — add to `ecommerce-storefront/src/components/site/cart-refresh.test.ts`:

```ts
test('patches the line with the USD price when USD is active', async () => {
  const line = { productId: 'p1', slug: 'tee', name: 'Tee', priceCents: 2900, image: null, quantity: 1, stockQty: 40 };
  const fetchBySlug = async () => ({
    ...product, priceCents: 2900, priceUsdCents: 2100, stockQty: 40, name: 'Tee', images: [],
  });

  const { updates } = await refreshCartLines([line], fetchBySlug, 'USD');

  expect(updates[0].patch.priceCents).toBe(2100);
});
```

Reuse whatever `product` fixture the file already defines. Run it and confirm it fails:

Run: `cd ecommerce-storefront && npx vitest run src/components/site/cart-refresh.test.ts`
Expected: FAIL — `refreshCartLines` takes two parameters.

Then change `cart-refresh.ts`. Import the helper and type:

```ts
import { priceFor } from '@/lib/currency';
import type { Currency } from '@/lib/money';
```

Add the parameter to `refreshCartLines` and use it in the comparison at line 34:

```ts
export async function refreshCartLines(
  lines: CartLine[],
  fetchBySlug: (slug: string) => Promise<ProductResponseDto>,
  currency: Currency,
): Promise<{ updates: Array<{ productId: string; patch: LinePatch }>; unavailable: string[] }> {
```

```ts
    // The cart caches a price per line, so it must be re-read in whatever
    // currency is active — otherwise switching currency leaves stale amounts.
    const activePrice = priceFor(product, currency);
    if (activePrice !== line.priceCents) patch.priceCents = activePrice;
```

Add it to `applyCartRefresh` too, and record the currency the cart is now priced in:

```ts
export async function applyCartRefresh(
  lines: CartLine[],
  currency: Currency,
  fetchBySlug: (slug: string) => Promise<ProductResponseDto> = defaultFetchBySlug,
): Promise<{ removedUnavailable: boolean }> {
  const { updates, unavailable } = await refreshCartLines(lines, fetchBySlug, currency);
  updates.forEach(({ productId, patch }) => updateLineMeta(productId, patch));
  unavailable.forEach((productId) => removeLine(productId));
  setCartCurrency(currency);
  return { removedUnavailable: unavailable.length > 0 };
}
```

Add `setCartCurrency` to the `@/cart/store` import.

Run: `cd ecommerce-storefront && npx vitest run src/components/site/cart-refresh.test.ts`
Expected: PASS.

- [ ] **Step 6: Re-run the refresh when the currency changes**

In the cart page (`src/app/(store)/cart/page.tsx` or the client component it renders — find with `grep -rn "applyCartRefresh" src/app src/components`), the mount effect currently calls `applyCartRefresh(lines)`. Pass the active currency and re-run whenever it changes:

```tsx
  useEffect(() => {
    if (lines.length === 0) return;
    void applyCartRefresh(lines, currency);
    // Re-runs on a currency switch so cached line prices are re-read in the
    // newly selected currency.
  }, [currency]);
```

The page reads `currency` from a prop threaded down from the server component that read the cookie in Task 12.

- [ ] **Step 7: Send the currency to checkout**

`src/components/site/CheckoutButton.tsx` accepts `lines` and `couponCode`. Add `currency` and include it in the request body:

```tsx
export function CheckoutButton({
  lines,
  couponCode,
  currency,
}: {
  lines: CartLine[];
  couponCode?: string;
  currency: Currency;
}) {
```

```tsx
        checkoutControllerCreate({
          body: {
            items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
            currency,
            ...(couponCode ? { couponCode } : {}),
          },
        }),
```

Its error handler also calls `applyCartRefresh(lines)` at line 54 — update that to `applyCartRefresh(lines, currency)`. Add `import type { Currency } from '@/lib/money';` and pass `currency` from the cart page where `<CheckoutButton>` is rendered.

- [ ] **Step 8: Run the full suite and build**

Run: `cd ecommerce-storefront && npm test`
Expected: all tests pass.

Then, with `next dev` stopped (they share `.next`, and a build will kill the dev server):

```bash
cd ecommerce-storefront && NEXT_PUBLIC_API_URL=http://localhost:3002 npm run build
```

Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add ecommerce-storefront/src
git commit -m "Storefront: keep the cart in the active currency and bill in it"
```

---

### Task 15: Rewrite the shipping copy for Canada and the US

**Files:**
- Modify: `ecommerce-storefront/src/lib/site.ts:14-16`
- Modify: `ecommerce-storefront/src/app/(store)/shipping/page.tsx`
- Modify: `ecommerce-storefront/src/app/(store)/terms/page.tsx`

**Interfaces:**
- Consumes: nothing. Copy only.

- [ ] **Step 1: Replace the international threshold with a USD one**

In `ecommerce-storefront/src/lib/site.ts`, replace `freeShippingInternational` (the site no longer claims worldwide delivery) with the US-dollar counterpart of the domestic threshold:

```ts
    freeShipping: '$65 CAD',
    freeShippingUsd: '$49 USD',
```

Then grep for the removed key and fix every reference: `cd ecommerce-storefront && grep -rn "freeShippingInternational" src`. Expected after edits: no results.

- [ ] **Step 2: Rewrite the shipping page**

In `ecommerce-storefront/src/app/(store)/shipping/page.tsx`, delete the entire "International shipping" section — the worldwide claim, the 15-to-25-day estimate, and the customs/duties paragraph — because checkout accepts only `CA` and `US`. Replace it with a US section:

```tsx
      <section>
        <h2 className="font-display text-xl text-ink">Shipping to the United States</h2>
        <p className="mt-2">
          We ship across the US with free standard delivery on orders over{' '}
          {policy.freeShippingUsd}. Standard delivery takes 5 to 9 business
          days, and expedited rates are calculated at checkout based on your
          location.
        </p>
        <p className="mt-4">
          US orders are priced and charged in US dollars — switch the currency
          at the bottom of any page to see US pricing.
        </p>
      </section>
```

Update the "Shipping within Canada" heading's neighbouring copy only if it references worldwide delivery.

- [ ] **Step 3: Remove the worldwide claim from the terms page**

Run `cd ecommerce-storefront && grep -n "worldwide\|international" src/app/\(store\)/terms/page.tsx` and rewrite any hit to say Canada and the United States. If there are no hits, this step is a no-op.

- [ ] **Step 4: Verify no worldwide claims remain**

Run:

```bash
cd ecommerce-storefront && grep -rniE "worldwide|internationally|customs duties" src/app src/lib
```

Expected: no results.

- [ ] **Step 5: Run the suite**

Run: `cd ecommerce-storefront && npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add ecommerce-storefront/src
git commit -m "Storefront: shipping copy covers Canada and the US only"
```

---

### Task 16: End-to-end verification against the local mirror

**Files:** none modified — this is a verification gate.

- [ ] **Step 1: Point the API at a disposable database**

Never run this against production. Use the local mirror:

```bash
cd ecommerce-api && DATABASE_URL="postgresql://ecommerce:ecommerce@localhost:5434/ecommerce" npx prisma migrate deploy
```

Expected: the dual-currency migration applies.

- [ ] **Step 2: Start the stack**

```bash
cd ecommerce-api && DATABASE_URL="postgresql://ecommerce:ecommerce@localhost:5434/ecommerce" PORT=3002 npm run start:dev
```

and in a second shell:

```bash
cd ecommerce-storefront && PORT=3000 npm run dev
```

- [ ] **Step 3: Confirm both prices are served**

Run: `curl -s http://localhost:3002/products | grep -o '"priceUsdCents":[0-9]*' | head -3`
Expected: three matches with non-null integers.

- [ ] **Step 4: Confirm the storefront switches currency**

Run:

```bash
curl -s http://localhost:3000/products | grep -o 'CAD \$[0-9.,]*' | head -3
curl -s --cookie "localninja.currency=USD" http://localhost:3000/products | grep -o 'USD \$[0-9.,]*' | head -3
```

Expected: the first prints `CAD $…` prices, the second prints `USD $…` prices.

- [ ] **Step 5: Confirm the whole test suite is green**

```bash
cd ecommerce-api && npm test
cd ../ecommerce-admin && npm test
cd ../ecommerce-storefront && npm test
```

Expected: all three suites pass.

- [ ] **Step 6: Commit any fixes**

If steps 3 or 4 failed, fix and commit before considering the plan complete.

---

## Deployment note

The migration is additive but **not reversible without data loss** (`priceUsdCents` is dropped on rollback). Apply it to production before deploying the new API, and deploy the API before the storefront: an old API returning no `priceUsdCents` would make every USD price render as `undefined`.
