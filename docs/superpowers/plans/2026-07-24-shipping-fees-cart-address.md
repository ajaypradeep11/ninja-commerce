# Shipping Fees + Cart Address Selection + CAD-only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Charge admin-configurable shipping ($9.99 standard / $14.99 expedited, free standard at $65+) at Stripe checkout, let shoppers pick a saved address on the cart that prefills Stripe's page, and make the storefront CAD-only.

**Architecture:** A singleton `StoreSettings` Prisma row feeds Stripe `shipping_options` built in `CheckoutService`; a lazily-created Stripe Customer (id on `User.stripeCustomerId`) carries the selected shipping address so hosted Checkout prefills it; the storefront's currency resolution is pinned to CAD and the switcher removed; a new admin Settings page edits the three values via a regenerated client.

**Tech Stack:** NestJS 11 + Prisma 6 + Jest (API); Next.js 15 + Vitest/Testing Library (storefront); React 19 + Vite + TanStack Query + RHF/zod (admin).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-24-shipping-fees-design.md`. Branch: `feat/shipping-fees`.
- USD plumbing stays dormant, not removed: keep `priceUsdCents`, `Currency` enum, checkout `currency` param, admin USD fields, `priceFor`.
- Defaults (cents): threshold `6500`, standard `999`, expedited `1499`. Free-shipping test compares the **post-coupon** subtotal: `subtotalCents - (quote?.discountCents ?? 0) >= freeShippingThresholdCents`. Expedited is never free.
- Shipping rate display names exactly: `Standard (4-7 business days)` (estimate 4–7 business days) and `Expedited (2-4 business days)` (estimate 2–4 business days); both `tax_behavior: 'exclusive'`, `type: 'fixed_amount'`, currency = session currency lowercased.
- `shippingAddress` on checkout is optional; when present its `country` must be `CA` (else 400). With it, the session uses `customer: <id>` (never together with `customer_email`); without it, `customer_email: user.email` exactly as today.
- The local dev DB is the **test Supabase** (stack.env: DATABASE_EMULATOR=false) — `npx prisma migrate dev` applies there. Production Supabase needs `npx prisma migrate deploy` at deploy time (note only, not a task).
- API lint (`npm run lint`) auto-fixes — do not run it. Storefront/admin lint is oxlint (`npm run lint`).
- After any API contract change: `cd ecommerce-api && npm run openapi:emit`, then `npm run generate:api` in BOTH `ecommerce-storefront` and `ecommerce-admin`.

---

### Task 1: API — StoreSettings model + admin settings endpoints

**Files:**
- Modify: `ecommerce-api/prisma/schema.prisma` (append model)
- Create: `ecommerce-api/src/settings/settings.module.ts`
- Create: `ecommerce-api/src/settings/settings.service.ts`
- Create: `ecommerce-api/src/settings/settings.controller.ts`
- Create: `ecommerce-api/src/settings/dto/shipping-settings.dto.ts`
- Modify: `ecommerce-api/src/app.module.ts` (register SettingsModule)
- Test: `ecommerce-api/src/settings/settings.service.spec.ts`, `ecommerce-api/src/settings/settings.controller.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, existing `FirebaseAuthGuard` + `AdminGuard` (mirror the decorators used by `src/admin/admin.controller.ts`).
- Produces (Task 2 and Task 7 rely on these exactly):
  - Prisma model `StoreSettings` (fields below).
  - `SettingsService.getShippingSettings(): Promise<StoreSettings>` — never throws on missing row (upsert-on-read).
  - `SettingsService.updateShippingSettings(dto: UpdateShippingSettingsDto): Promise<StoreSettings>`.
  - `GET /admin/settings/shipping` → `ShippingSettingsDto`; `PUT /admin/settings/shipping` body `UpdateShippingSettingsDto` → `ShippingSettingsDto`. Both admin-guarded.
  - `SettingsModule` exports `SettingsService`.

- [ ] **Step 1: Add the model and migrate**

Append to `ecommerce-api/prisma/schema.prisma`:

```prisma
model StoreSettings {
  id                         Int      @id @default(1)
  freeShippingThresholdCents Int      @default(6500)
  standardShippingCents      Int      @default(999)
  expeditedShippingCents     Int      @default(1499)
  updatedAt                  DateTime @updatedAt
}
```

Run: `cd ecommerce-api && npx prisma migrate dev --name store_settings`
Expected: migration created and applied; client regenerated.

- [ ] **Step 2: Write the failing service/controller tests**

`ecommerce-api/src/settings/settings.service.spec.ts`:

```ts
import { SettingsService } from './settings.service';

const ROW = {
  id: 1,
  freeShippingThresholdCents: 6500,
  standardShippingCents: 999,
  expeditedShippingCents: 1499,
  updatedAt: new Date('2026-07-24T00:00:00Z'),
};

describe('SettingsService', () => {
  let prisma: { storeSettings: { upsert: jest.Mock } };
  let service: SettingsService;

  beforeEach(() => {
    prisma = { storeSettings: { upsert: jest.fn().mockResolvedValue(ROW) } };
    service = new SettingsService(prisma as never);
  });

  it('reads via upsert so a missing row is created with defaults', async () => {
    const result = await service.getShippingSettings();
    expect(prisma.storeSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
    expect(result).toEqual(ROW);
  });

  it('updates all three fields via upsert', async () => {
    const dto = {
      freeShippingThresholdCents: 7000,
      standardShippingCents: 1099,
      expeditedShippingCents: 1599,
    };
    await service.updateShippingSettings(dto);
    expect(prisma.storeSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: dto,
      create: { id: 1, ...dto },
    });
  });
});
```

`ecommerce-api/src/settings/settings.controller.spec.ts`:

```ts
import { SettingsController } from './settings.controller';

const ROW = {
  id: 1,
  freeShippingThresholdCents: 6500,
  standardShippingCents: 999,
  expeditedShippingCents: 1499,
  updatedAt: new Date(),
};

describe('SettingsController', () => {
  const service = {
    getShippingSettings: jest.fn().mockResolvedValue(ROW),
    updateShippingSettings: jest.fn().mockResolvedValue({
      ...ROW,
      standardShippingCents: 1099,
    }),
  };
  const controller = new SettingsController(service as never);

  it('maps the row to the three public fields on GET', async () => {
    await expect(controller.getShipping()).resolves.toEqual({
      freeShippingThresholdCents: 6500,
      standardShippingCents: 999,
      expeditedShippingCents: 1499,
    });
  });

  it('updates then maps on PUT', async () => {
    const dto = {
      freeShippingThresholdCents: 6500,
      standardShippingCents: 1099,
      expeditedShippingCents: 1499,
    };
    await expect(controller.updateShipping(dto)).resolves.toEqual(dto);
    expect(service.updateShippingSettings).toHaveBeenCalledWith(dto);
  });

  it('is admin-guarded', () => {
    // Mirror the guard-metadata assertion style used elsewhere if present;
    // otherwise assert the guards metadata directly:
    const guards = Reflect.getMetadata('__guards__', SettingsController) as unknown[];
    expect(guards?.length).toBeGreaterThanOrEqual(2);
  });
});
```

Run: `cd ecommerce-api && npx jest src/settings` — Expected: FAIL (modules don't exist).

- [ ] **Step 3: Implement DTOs, service, controller, module**

`ecommerce-api/src/settings/dto/shipping-settings.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class ShippingSettingsDto {
  @ApiProperty()
  freeShippingThresholdCents!: number;

  @ApiProperty()
  standardShippingCents!: number;

  @ApiProperty()
  expeditedShippingCents!: number;
}

export class UpdateShippingSettingsDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  freeShippingThresholdCents!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  standardShippingCents!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  expeditedShippingCents!: number;
}
```

`ecommerce-api/src/settings/settings.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { StoreSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateShippingSettingsDto } from './dto/shipping-settings.dto';

// Singleton row (id=1). Reads upsert so a fresh database never 500s — the
// schema defaults ARE the store defaults.
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  getShippingSettings(): Promise<StoreSettings> {
    return this.prisma.storeSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  }

  updateShippingSettings(dto: UpdateShippingSettingsDto): Promise<StoreSettings> {
    return this.prisma.storeSettings.upsert({
      where: { id: 1 },
      update: dto,
      create: { id: 1, ...dto },
    });
  }
}
```

`ecommerce-api/src/settings/settings.controller.ts` — mirror `src/admin/admin.controller.ts`'s guard/decorator usage (`@UseGuards(FirebaseAuthGuard, AdminGuard)` plus whatever swagger decorators that file carries):

```ts
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import {
  ShippingSettingsDto,
  UpdateShippingSettingsDto,
} from './dto/shipping-settings.dto';
import { SettingsService } from './settings.service';
import { StoreSettings } from '@prisma/client';

const toDto = (row: StoreSettings): ShippingSettingsDto => ({
  freeShippingThresholdCents: row.freeShippingThresholdCents,
  standardShippingCents: row.standardShippingCents,
  expeditedShippingCents: row.expeditedShippingCents,
});

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, AdminGuard)
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('shipping')
  @ApiOkResponse({ type: ShippingSettingsDto })
  async getShipping(): Promise<ShippingSettingsDto> {
    return toDto(await this.settings.getShippingSettings());
  }

  @Put('shipping')
  @ApiOkResponse({ type: ShippingSettingsDto })
  async updateShipping(
    @Body() dto: UpdateShippingSettingsDto,
  ): Promise<ShippingSettingsDto> {
    return toDto(await this.settings.updateShippingSettings(dto));
  }
}
```

`ecommerce-api/src/settings/settings.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
```

Register in `ecommerce-api/src/app.module.ts`: add `SettingsModule` to the imports array (alongside the other feature modules) with its import statement.

- [ ] **Step 4: Run tests**

Run: `cd ecommerce-api && npx jest src/settings` — Expected: PASS (5 tests).
Run: `cd ecommerce-api && npm test` — Expected: full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add ecommerce-api/prisma ecommerce-api/src/settings ecommerce-api/src/app.module.ts
git commit -m "API: StoreSettings singleton with admin shipping-settings endpoints"
```

---

### Task 2: API — Stripe shipping_options from settings

**Files:**
- Modify: `ecommerce-api/src/checkout/checkout.service.ts`
- Modify: `ecommerce-api/src/checkout/checkout.module.ts`
- Test: `ecommerce-api/src/checkout/checkout.service.spec.ts`

**Interfaces:**
- Consumes: `SettingsService.getShippingSettings()` from Task 1 (`SettingsModule` exported).
- Produces: every Stripe session includes `shipping_options` (2 entries, shapes per Global Constraints).

- [ ] **Step 1: Add failing spec coverage**

In `ecommerce-api/src/checkout/checkout.service.spec.ts`:

Add a settings mock next to the existing service mocks:

```ts
const settings = {
  getShippingSettings: jest.fn(),
};
```

In `beforeEach`, add a default resolution and pass `settings` to the constructor in the same position as the service's constructor signature (settings goes after `coupons`, before `config` — keep consistent with Step 2):

```ts
settings.getShippingSettings.mockResolvedValue({
  id: 1,
  freeShippingThresholdCents: 6500,
  standardShippingCents: 999,
  expeditedShippingCents: 1499,
  updatedAt: new Date(),
});
```

New tests (use the existing test's arrange pattern — `prisma.product.findMany` resolving one product, `stripe.client.checkout.sessions.create` resolving `{ id: 'cs_1', url: 'https://stripe.test/session' }`):

```ts
const expectedRate = (
  name: string,
  amount: number,
  min: number,
  max: number,
  currency = 'cad',
) => ({
  shipping_rate_data: {
    display_name: name,
    type: 'fixed_amount',
    fixed_amount: { amount, currency },
    tax_behavior: 'exclusive',
    delivery_estimate: {
      minimum: { unit: 'business_day', value: min },
      maximum: { unit: 'business_day', value: max },
    },
  },
});

it('charges standard and expedited shipping below the free threshold', async () => {
  prisma.product.findMany.mockResolvedValue([
    { id: 'p1', name: 'Tee', priceCents: 2500, priceUsdCents: 1900, stockQty: 5, active: true },
  ]);
  stripe.client.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/session' });

  await service.createSession(user, { items: [{ productId: 'p1', quantity: 1 }], currency: 'CAD' });

  const session = stripe.client.checkout.sessions.create.mock.calls[0][0];
  expect(session.shipping_options).toEqual([
    expectedRate('Standard (4-7 business days)', 999, 4, 7),
    expectedRate('Expedited (2-4 business days)', 1499, 2, 4),
  ]);
});

it('makes standard free at the threshold while expedited stays paid', async () => {
  prisma.product.findMany.mockResolvedValue([
    { id: 'p1', name: 'Lamp', priceCents: 6500, priceUsdCents: 4900, stockQty: 5, active: true },
  ]);
  stripe.client.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/session' });

  await service.createSession(user, { items: [{ productId: 'p1', quantity: 1 }], currency: 'CAD' });

  const session = stripe.client.checkout.sessions.create.mock.calls[0][0];
  expect(session.shipping_options).toEqual([
    expectedRate('Standard (4-7 business days)', 0, 4, 7),
    expectedRate('Expedited (2-4 business days)', 1499, 2, 4),
  ]);
});

it('uses the post-coupon subtotal for the free-shipping threshold', async () => {
  // 70.00 cart with a 10.00 coupon → 60.00 discounted → below 65.00 → paid shipping
  prisma.product.findMany.mockResolvedValue([
    { id: 'p1', name: 'Lamp', priceCents: 7000, priceUsdCents: 4900, stockQty: 5, active: true },
  ]);
  coupons.quoteForUser.mockResolvedValue({
    coupon: { id: 'c1', code: 'SAVE10', type: 'FIXED', value: 1000 },
    discountCents: 1000,
  });
  stripe.client.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/session' });

  await service.createSession(user, {
    items: [{ productId: 'p1', quantity: 1 }],
    currency: 'CAD',
    couponCode: 'SAVE10',
  });

  const session = stripe.client.checkout.sessions.create.mock.calls[0][0];
  expect(session.shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(999);
});
```

(If the existing spec's coupon test mocks `stripe.client.coupons.create`, reuse that arrangement for the third test.)

Run: `cd ecommerce-api && npx jest src/checkout/checkout.service.spec.ts` — Expected: FAIL (constructor arity + missing shipping_options).

- [ ] **Step 2: Implement**

In `ecommerce-api/src/checkout/checkout.service.ts`:

Add import `import { SettingsService } from '../settings/settings.service';` and constructor param `private readonly settings: SettingsService,` after `coupons`, before `config`.

Add a module-level helper below `unitAmountFor`:

```ts
const shippingRate = (
  displayName: string,
  amountCents: number,
  currency: string,
  minDays: number,
  maxDays: number,
) => ({
  shipping_rate_data: {
    display_name: displayName,
    type: 'fixed_amount' as const,
    fixed_amount: { amount: amountCents, currency },
    // Prices are tax-exclusive; Stripe Tax adds the destination tax on top.
    tax_behavior: 'exclusive' as const,
    delivery_estimate: {
      minimum: { unit: 'business_day' as const, value: minDays },
      maximum: { unit: 'business_day' as const, value: maxDays },
    },
  },
});
```

In `createSession`, after the coupon quote (before the order create is fine, but the natural spot is right before building the session):

```ts
const shippingSettings = await this.settings.getShippingSettings();
const discountedSubtotalCents = subtotalCents - (quote?.discountCents ?? 0);
const sessionCurrency = dto.currency.toLowerCase();
const shippingOptions = [
  shippingRate(
    'Standard (4-7 business days)',
    discountedSubtotalCents >= shippingSettings.freeShippingThresholdCents
      ? 0
      : shippingSettings.standardShippingCents,
    sessionCurrency,
    4,
    7,
  ),
  shippingRate(
    'Expedited (2-4 business days)',
    shippingSettings.expeditedShippingCents,
    sessionCurrency,
    2,
    4,
  ),
];
```

and add `shipping_options: shippingOptions,` to the `sessions.create({...})` params.

In `ecommerce-api/src/checkout/checkout.module.ts`: add `SettingsModule` to imports.

- [ ] **Step 3: Run tests**

Run: `cd ecommerce-api && npx jest src/checkout/checkout.service.spec.ts` — Expected: PASS.
Run: `cd ecommerce-api && npm test` — Expected: full suite PASS.

- [ ] **Step 4: Commit**

```bash
git add ecommerce-api/src/checkout
git commit -m "API: checkout charges settings-driven shipping options"
```

---

### Task 3: API — stripeCustomerId + shipping-address prefill, regen clients

**Files:**
- Modify: `ecommerce-api/prisma/schema.prisma` (User)
- Modify: `ecommerce-api/src/checkout/dto/create-checkout.dto.ts`
- Modify: `ecommerce-api/src/checkout/checkout.service.ts`
- Test: `ecommerce-api/src/checkout/checkout.service.spec.ts`
- Regenerate: `ecommerce-api/openapi.json`, `ecommerce-storefront/src/api/generated`, `ecommerce-admin/src/api/generated`

**Interfaces:**
- Consumes: `AddressDto` from `../users/dto/update-addresses.dto` (has optional `name`, required `line1/city/postalCode/country`, optional `line2/state/label`).
- Produces: `CreateCheckoutDto.shippingAddress?: AddressDto`; sessions created with `customer` when an address is sent, `customer_email` otherwise. Task 6's storefront POST relies on the regenerated client exposing `shippingAddress`.

- [ ] **Step 1: Migration**

In `ecommerce-api/prisma/schema.prisma`, add to `model User`:

```prisma
  stripeCustomerId String? @unique
```

Run: `cd ecommerce-api && npx prisma migrate dev --name user_stripe_customer` — Expected: applied.

- [ ] **Step 2: Failing spec coverage**

In `checkout.service.spec.ts`, extend the mocks:

```ts
// prisma mock gains:
user: {
  findUnique: jest.fn(),
  update: jest.fn().mockResolvedValue({}),
},
// stripe.client mock gains:
customers: {
  create: jest.fn(),
  update: jest.fn().mockResolvedValue({}),
},
```

New tests (`ADDRESS` fixture at describe scope):

```ts
const ADDRESS = {
  name: 'Riley Shopper',
  line1: '205-1600 Merivale Rd',
  city: 'Nepean',
  state: 'ON',
  postalCode: 'K2G 5J8',
  country: 'CA',
};

it('creates a Stripe customer once, sets shipping, and passes customer instead of customer_email', async () => {
  prisma.product.findMany.mockResolvedValue([
    { id: 'p1', name: 'Tee', priceCents: 2500, priceUsdCents: 1900, stockQty: 5, active: true },
  ]);
  prisma.user.findUnique.mockResolvedValue({ id: 'u1', stripeCustomerId: null });
  stripe.client.customers.create.mockResolvedValue({ id: 'cus_1' });
  stripe.client.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/session' });

  await service.createSession(user, {
    items: [{ productId: 'p1', quantity: 1 }],
    currency: 'CAD',
    shippingAddress: ADDRESS,
  });

  expect(stripe.client.customers.create).toHaveBeenCalledWith({ email: user.email });
  expect(prisma.user.update).toHaveBeenCalledWith({
    where: { id: user.uid },
    data: { stripeCustomerId: 'cus_1' },
  });
  expect(stripe.client.customers.update).toHaveBeenCalledWith('cus_1', {
    shipping: {
      name: 'Riley Shopper',
      address: {
        line1: '205-1600 Merivale Rd',
        line2: undefined,
        city: 'Nepean',
        state: 'ON',
        postal_code: 'K2G 5J8',
        country: 'CA',
      },
    },
  });
  const session = stripe.client.checkout.sessions.create.mock.calls[0][0];
  expect(session.customer).toBe('cus_1');
  expect(session.customer_email).toBeUndefined();
});

it('reuses a stored Stripe customer id', async () => {
  prisma.product.findMany.mockResolvedValue([
    { id: 'p1', name: 'Tee', priceCents: 2500, priceUsdCents: 1900, stockQty: 5, active: true },
  ]);
  prisma.user.findUnique.mockResolvedValue({ id: 'u1', stripeCustomerId: 'cus_9' });
  stripe.client.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/session' });

  await service.createSession(user, {
    items: [{ productId: 'p1', quantity: 1 }],
    currency: 'CAD',
    shippingAddress: ADDRESS,
  });

  expect(stripe.client.customers.create).not.toHaveBeenCalled();
  expect(stripe.client.customers.update).toHaveBeenCalledWith('cus_9', expect.anything());
});

it('recovers from a stale stored customer id', async () => {
  prisma.product.findMany.mockResolvedValue([
    { id: 'p1', name: 'Tee', priceCents: 2500, priceUsdCents: 1900, stockQty: 5, active: true },
  ]);
  prisma.user.findUnique.mockResolvedValue({ id: 'u1', stripeCustomerId: 'cus_gone' });
  stripe.client.customers.update.mockRejectedValueOnce(
    Object.assign(new Error('No such customer'), { code: 'resource_missing' }),
  );
  stripe.client.customers.create.mockResolvedValue({ id: 'cus_new' });
  stripe.client.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/session' });

  await service.createSession(user, {
    items: [{ productId: 'p1', quantity: 1 }],
    currency: 'CAD',
    shippingAddress: ADDRESS,
  });

  expect(stripe.client.customers.create).toHaveBeenCalledWith({
    email: user.email,
    shipping: expect.anything(),
  });
  expect(prisma.user.update).toHaveBeenLastCalledWith({
    where: { id: user.uid },
    data: { stripeCustomerId: 'cus_new' },
  });
  const session = stripe.client.checkout.sessions.create.mock.calls[0][0];
  expect(session.customer).toBe('cus_new');
});

it('rejects a non-Canadian shipping address with 400', async () => {
  // BadRequestException import: add to the spec's imports from '@nestjs/common'.
  await expect(
    service.createSession(user, {
      items: [{ productId: 'p1', quantity: 1 }],
      currency: 'CAD',
      shippingAddress: { ...ADDRESS, country: 'US' },
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
});

it('keeps customer_email when no shipping address is sent', async () => {
  prisma.product.findMany.mockResolvedValue([
    { id: 'p1', name: 'Tee', priceCents: 2500, priceUsdCents: 1900, stockQty: 5, active: true },
  ]);
  stripe.client.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/session' });

  await service.createSession(user, { items: [{ productId: 'p1', quantity: 1 }], currency: 'CAD' });

  const session = stripe.client.checkout.sessions.create.mock.calls[0][0];
  expect(session.customer_email).toBe(user.email);
  expect(session.customer).toBeUndefined();
  expect(stripe.client.customers.create).not.toHaveBeenCalled();
});
```

Run: `npx jest src/checkout/checkout.service.spec.ts` — Expected: new tests FAIL.

- [ ] **Step 3: Implement**

`create-checkout.dto.ts` — add imports (`Type` from class-transformer is already imported or add it; `ValidateNested`, `IsOptional`) and `AddressDto`:

```ts
import { AddressDto } from '../../users/dto/update-addresses.dto';
```

and on `CreateCheckoutDto`:

```ts
  @ApiProperty({ required: false, type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress?: AddressDto;
```

`checkout.service.ts` — add `BadRequestException` to the `@nestjs/common` import and `import { AddressDto } from '../users/dto/update-addresses.dto';`. Add private helpers:

```ts
private async stripeCustomerId(user: AuthUser): Promise<string> {
  const row = await this.prisma.user.findUnique({ where: { id: user.uid } });
  if (row?.stripeCustomerId) return row.stripeCustomerId;
  const customer = await this.stripe.client.customers.create({
    email: user.email,
  });
  await this.prisma.user.update({
    where: { id: user.uid },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

// Sets the chosen address as the customer's shipping so hosted Checkout
// prefills it (fields stay editable there). Recovers if the stored customer
// id no longer exists on Stripe (e.g. test/live key switch).
private async customerWithShipping(
  user: AuthUser,
  address: AddressDto,
): Promise<string> {
  const shipping = {
    name: address.name ?? user.email,
    address: {
      line1: address.line1,
      line2: address.line2 ?? undefined,
      city: address.city,
      state: address.state ?? undefined,
      postal_code: address.postalCode,
      country: address.country,
    },
  };
  const customerId = await this.stripeCustomerId(user);
  try {
    await this.stripe.client.customers.update(customerId, { shipping });
    return customerId;
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code !== 'resource_missing') throw err;
    const fresh = await this.stripe.client.customers.create({
      email: user.email,
      shipping,
    });
    await this.prisma.user.update({
      where: { id: user.uid },
      data: { stripeCustomerId: fresh.id },
    });
    return fresh.id;
  }
}
```

In `createSession`, validate early (right after the duplicate-items check):

```ts
if (dto.shippingAddress && dto.shippingAddress.country !== 'CA') {
  throw new BadRequestException('Shipping is available within Canada only');
}
```

Before building the session (next to the shipping options):

```ts
const customerId = dto.shippingAddress
  ? await this.customerWithShipping(user, dto.shippingAddress)
  : null;
```

and in the `sessions.create` params replace `customer_email: user.email,` with:

```ts
...(customerId
  ? { customer: customerId }
  : { customer_email: user.email }),
```

- [ ] **Step 4: Run tests, emit, regen**

Run: `cd ecommerce-api && npm test` — Expected: PASS.
Run: `cd ecommerce-api && npm run openapi:emit`
Run: `cd ecommerce-storefront && npm run generate:api && cd ../ecommerce-admin && npm run generate:api`
Verify: `grep -n "shippingAddress" ecommerce-storefront/src/api/generated/types.gen.ts` — Expected: present on the checkout body type.

- [ ] **Step 5: Commit**

```bash
git add ecommerce-api/prisma ecommerce-api/src/checkout ecommerce-api/openapi.json ecommerce-storefront/src/api/generated ecommerce-admin/src/api/generated
git commit -m "API: checkout prefills Stripe with a chosen shipping address"
```

---

### Task 4: Storefront — CAD-only (switcher removed, currency pinned)

**Files:**
- Modify: `ecommerce-storefront/src/lib/currency.ts`
- Modify: `ecommerce-storefront/src/components/site/Header.tsx`
- Delete: `ecommerce-storefront/src/components/site/CurrencySwitcher.tsx`, `CurrencySwitcher.test.tsx`
- Test: `ecommerce-storefront/src/lib/currency.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `parseCurrency()`/`readClientCurrency()` always return `'CAD'` (signatures unchanged — all call sites keep compiling); Header no longer renders a switcher.

- [ ] **Step 1: Update currency tests to expect CAD always**

In `ecommerce-storefront/src/lib/currency.test.ts`, change every assertion that expects `'USD'` from `parseCurrency('USD')` (or a USD cookie via `readClientCurrency`) to expect `'CAD'`, and add/keep a test name that documents the pin, e.g.:

```ts
it('ignores a stored USD preference — the store is CAD-only', () => {
  expect(parseCurrency('USD')).toBe('CAD');
});
```

Keep all `priceFor` tests unchanged (dormant plumbing still selects the USD column when explicitly asked).

Run: `cd ecommerce-storefront && npx vitest run src/lib/currency.test.ts` — Expected: FAIL.

- [ ] **Step 2: Pin the resolution**

In `ecommerce-storefront/src/lib/currency.ts`:

```ts
// CAD-only store: the dual-currency plumbing (priceUsdCents, priceFor, the
// checkout currency param) stays dormant, but every preference resolves to
// CAD. Re-enable by restoring the cookie parse here and the header switcher.
export function parseCurrency(_raw: string | undefined): Currency {
  return 'CAD';
}

export function readClientCurrency(): Currency {
  return 'CAD';
}
```

(Keep `CURRENCY_COOKIE`/`CURRENCY_COOKIE_MAX_AGE` exports if other files import them; delete them only if `grep -rn "CURRENCY_COOKIE" src` shows no remaining consumers after Step 3.)

- [ ] **Step 3: Remove the switcher**

- `Header.tsx`: delete the `CurrencySwitcher` import and its `<CurrencySwitcher current={currency} />` render; if `currency`/`parseCurrency`/`cookies()` become unused in that file, remove them too.
- Delete `src/components/site/CurrencySwitcher.tsx` and `src/components/site/CurrencySwitcher.test.tsx`.
- Run `grep -rn "CurrencySwitcher" src` — Expected: no matches.

- [ ] **Step 4: Full suite + lint**

Run: `cd ecommerce-storefront && npm run lint && npm test` — Expected: clean, all remaining tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A ecommerce-storefront/src
git commit -m "Storefront: CAD-only — currency pinned, switcher removed"
```

---

### Task 5: Storefront — extract the shared AddressForm

**Files:**
- Create: `ecommerce-storefront/src/components/site/AddressForm.tsx`
- Modify: `ecommerce-storefront/src/components/site/AddressManager.tsx`

**Interfaces:**
- Produces: `AddressForm` component exported from its own file with the exact props it has today (`{ initial?: AddressDto; onSubmit: (values: AddressDto) => void; onCancel: () => void; disabled?: boolean }`), including schema, `BLANK`, postal normalization, and the `AddressAutocomplete` wiring. Task 6 imports it.

- [ ] **Step 1: Move, don't rewrite**

Cut `POSTAL_CODE_RE`, `schema`, `FormInput`/`FormOutput`, `BLANK`, and the whole `AddressForm` function out of `AddressManager.tsx` into `ecommerce-storefront/src/components/site/AddressForm.tsx`, adding `'use client';`, moving exactly the imports the moved code needs (`zodResolver`, `useForm`, `z`, `AddressDto` type, `AddressAutocomplete`, `Button`, `DialogFooter`, `Input`, `Label`), and `export function AddressForm`. In `AddressManager.tsx` add `import { AddressForm } from './AddressForm';` and delete the now-unused imports.

- [ ] **Step 2: Verify nothing changed behaviorally**

Run: `cd ecommerce-storefront && npx vitest run src/components/site/AddressManager.test.tsx` — Expected: all 8 PASS untouched.
Run: `npm run lint && npm test` — Expected: clean/PASS.

- [ ] **Step 3: Commit**

```bash
git add ecommerce-storefront/src/components/site/AddressForm.tsx ecommerce-storefront/src/components/site/AddressManager.tsx
git commit -m "Storefront: extract AddressForm for reuse beyond the account page"
```

---

### Task 6: Storefront — cart "Ship to" selector wired into checkout

**Files:**
- Create: `ecommerce-storefront/src/components/site/ShipToSelector.tsx`
- Test: `ecommerce-storefront/src/components/site/ShipToSelector.test.tsx`
- Modify: `ecommerce-storefront/src/app/(store)/cart/page.tsx`
- Modify: `ecommerce-storefront/src/components/site/CartSummary.tsx`
- Modify: `ecommerce-storefront/src/components/site/CheckoutButton.tsx`
- Test: `ecommerce-storefront/src/components/site/CheckoutButton.test.tsx`

**Interfaces:**
- Consumes: `AddressForm` (Task 5), `useMe`/`useUpdateAddresses` (`@/api/hooks/account`), `useAuth` (`@/auth/AuthProvider`), regenerated checkout body with `shippingAddress` (Task 3), `AddressDto` from `@/api/generated`.
- Produces: `<ShipToSelector selected onSelect />`; `CartSummary` and `CheckoutButton` accept `shippingAddress?: AddressDto` and the checkout POST includes it when set.

- [ ] **Step 1: Write failing ShipToSelector tests**

`ecommerce-storefront/src/components/site/ShipToSelector.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AddressDto } from '@/api/generated';

const useMeMock = vi.fn();
const mutateMock = vi.fn();
vi.mock('@/api/hooks/account', () => ({
  useMe: () => useMeMock(),
  useUpdateAddresses: () => ({ mutate: mutateMock, isPending: false }),
}));
const useAuthMock = vi.fn();
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock('@/lib/addresscomplete', () => ({
  findAddresses: vi.fn().mockResolvedValue([]),
  retrieveAddress: vi.fn(),
}));

import { ShipToSelector } from './ShipToSelector';

const HOME: AddressDto = {
  name: 'Riley Shopper',
  label: 'Home',
  line1: '1 Main St',
  city: 'Ottawa',
  state: 'ON',
  postalCode: 'K1A 0B1',
  country: 'CA',
};
const WORK: AddressDto = {
  label: 'Work',
  line1: '2 Market St',
  city: 'Toronto',
  state: 'ON',
  postalCode: 'M5V 2T6',
  country: 'CA',
};

function makeMe(addresses: AddressDto[]) {
  return { data: { id: 'u1', email: 's@example.com', role: 'CUSTOMER', addresses, createdAt: '', updatedAt: '' } };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthMock.mockReturnValue({ user: { uid: 'u1' } });
});

describe('ShipToSelector', () => {
  it('renders nothing when signed out', () => {
    useAuthMock.mockReturnValue({ user: null });
    useMeMock.mockReturnValue({ data: undefined });
    const { container } = render(
      <ShipToSelector selected={null} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('preselects the first saved address', async () => {
    useMeMock.mockReturnValue(makeMe([HOME, WORK]));
    const onSelect = vi.fn();
    render(<ShipToSelector selected={null} onSelect={onSelect} />);
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(HOME));
  });

  it('lets the shopper pick a different address', async () => {
    useMeMock.mockReturnValue(makeMe([HOME, WORK]));
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<ShipToSelector selected={HOME} onSelect={onSelect} />);

    expect(screen.getByRole('radio', { name: /1 Main St/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /2 Market St/ }));
    expect(onSelect).toHaveBeenCalledWith(WORK);
  });

  it('adds a new address through the shared form and selects it', async () => {
    useMeMock.mockReturnValue(makeMe([]));
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<ShipToSelector selected={null} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Add address' }));
    await user.type(screen.getByLabelText('Address Line 1'), '3 New St');
    await user.type(screen.getByLabelText('City'), 'Kanata');
    await user.type(screen.getByLabelText('Postal code'), 'K2L 1T9');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    expect(mutateMock.mock.calls[0][0]).toHaveLength(1);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ line1: '3 New St', postalCode: 'K2L 1T9' }),
    );
  });
});
```

Run: `npx vitest run src/components/site/ShipToSelector.test.tsx` — Expected: FAIL (module not found).

- [ ] **Step 2: Implement ShipToSelector**

`ecommerce-storefront/src/components/site/ShipToSelector.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { AddressDto } from '@/api/generated';
import { useMe, useUpdateAddresses } from '@/api/hooks/account';
import { useAuth } from '@/auth/AuthProvider';
import { AddressForm } from '@/components/site/AddressForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const addressKey = (a: AddressDto) => `${a.line1}|${a.postalCode}|${a.label ?? ''}`;

// Cart-side picker for the saved-address book. Selecting is optional — with
// nothing selected the shopper types the address on Stripe's page as before.
export function ShipToSelector({
  selected,
  onSelect,
}: {
  selected: AddressDto | null;
  onSelect: (address: AddressDto | null) => void;
}) {
  const { user } = useAuth();
  const { data: me } = useMe();
  const updateAddresses = useUpdateAddresses();
  const [adding, setAdding] = useState(false);

  const addresses = me?.addresses ?? [];

  // Preselect the first saved address once the profile loads.
  const firstKey = addresses.length > 0 ? addressKey(addresses[0]) : null;
  useEffect(() => {
    if (!selected && addresses.length > 0) onSelect(addresses[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey]);

  if (!user) return null;

  function handleAdd(values: AddressDto) {
    updateAddresses.mutate([...addresses, values]);
    onSelect(values);
    setAdding(false);
  }

  return (
    <div className="border border-ink/10 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs tracking-wide text-ink/60 uppercase">
          Ship to
        </h2>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <p className="mt-3 text-sm text-ink/60">
          No saved addresses — add one, or enter it on the payment page.
        </p>
      ) : (
        <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Ship to">
          {addresses.map((address) => {
            const isSelected = selected !== null && addressKey(address) === addressKey(selected);
            return (
              <button
                key={addressKey(address)}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelect(address)}
                className={`border p-3 text-left text-sm ${
                  isSelected ? 'border-ink bg-ink/5' : 'border-ink/10'
                }`}
              >
                {address.label && (
                  <span className="font-mono text-xs tracking-wide text-ink/60 uppercase">
                    {address.label}
                    {' — '}
                  </span>
                )}
                {address.name && <span>{address.name}, </span>}
                <span>
                  {address.line1}, {address.city}
                  {address.state ? `, ${address.state}` : ''} {address.postalCode}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={adding} onOpenChange={(open) => !open && setAdding(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add address</DialogTitle>
          </DialogHeader>
          {adding && (
            <AddressForm
              onCancel={() => setAdding(false)}
              onSubmit={handleAdd}
              disabled={updateAddresses.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

Run: `npx vitest run src/components/site/ShipToSelector.test.tsx` — Expected: PASS (4 tests).

- [ ] **Step 3: Thread the address through checkout**

`CheckoutButton.tsx`: add `shippingAddress` to props —

```ts
export function CheckoutButton({
  lines,
  couponCode,
  currency,
  shippingAddress,
}: {
  lines: CartLine[];
  couponCode?: string;
  currency: Currency;
  shippingAddress?: AddressDto;
}) {
```

(import `AddressDto` type from `@/api/generated`), and in the POST body add:

```ts
...(shippingAddress ? { shippingAddress } : {}),
```

`CartSummary.tsx`: accept and pass through —

```ts
export function CartSummary({ lines, currency, shippingAddress }: { lines: CartLine[]; currency: Currency; shippingAddress?: AddressDto }) {
```

and `<CheckoutButton lines={lines} couponCode={quote?.code} currency={currency} shippingAddress={shippingAddress} />`.

`cart/page.tsx`: add state + render —

```ts
const [shipTo, setShipTo] = useState<AddressDto | null>(null);
```

render `<ShipToSelector selected={shipTo} onSelect={setShipTo} />` above `<CartSummary …>` (inside the same column as CartSummary so the layout stacks: selector, then summary), and pass `shippingAddress={shipTo ?? undefined}` to `CartSummary`.

- [ ] **Step 4: Extend CheckoutButton tests**

In `CheckoutButton.test.tsx`, add two tests. The file already mocks the generated client's `checkoutControllerCreate` and `useAuth` — REUSE its existing mock variables and its signed-in + successful-session arrangement verbatim (do not build a second mock layer); only the render props and the body assertion differ. With `checkoutCreateMock` standing in for whatever the file names its `checkoutControllerCreate` mock, and `LINES` for its existing cart-lines fixture:

```tsx
const HOME = {
  name: 'Riley Shopper',
  label: 'Home',
  line1: '1 Main St',
  city: 'Ottawa',
  state: 'ON',
  postalCode: 'K1A 0B1',
  country: 'CA',
};

it('includes the selected shipping address in the checkout body', async () => {
  // same signed-in + session-success arrangement as the existing POST test
  const user = userEvent.setup();
  render(
    <CheckoutButton lines={LINES} currency="CAD" shippingAddress={HOME} />,
  );
  await user.click(screen.getByRole('button', { name: /checkout/i }));

  await waitFor(() => expect(checkoutCreateMock).toHaveBeenCalledTimes(1));
  expect(checkoutCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      body: expect.objectContaining({ shippingAddress: HOME }),
    }),
  );
});

it('omits shippingAddress from the body when none is selected', async () => {
  const user = userEvent.setup();
  render(<CheckoutButton lines={LINES} currency="CAD" />);
  await user.click(screen.getByRole('button', { name: /checkout/i }));

  await waitFor(() => expect(checkoutCreateMock).toHaveBeenCalledTimes(1));
  const body = checkoutCreateMock.mock.calls[0][0].body;
  expect(body).not.toHaveProperty('shippingAddress');
});
```

(If the existing tests assert the button label differently, use the same `getByRole` query they use.)

- [ ] **Step 5: Full suite + lint**

Run: `cd ecommerce-storefront && npm run lint && npm test` — Expected: clean, PASS.

- [ ] **Step 6: Commit**

```bash
git add ecommerce-storefront/src
git commit -m "Storefront: cart address selection prefills Stripe checkout"
```

---

### Task 7: Admin — Settings page for shipping fees

**Files:**
- Create: `ecommerce-admin/src/api/hooks/settings.ts`
- Create: `ecommerce-admin/src/pages/settings/index.tsx`
- Test: `ecommerce-admin/src/pages/settings/SettingsPage.test.tsx`
- Modify: `ecommerce-admin/src/App.tsx` (route), `ecommerce-admin/src/components/layout/AppShell.tsx` (NAV entry)

**Interfaces:**
- Consumes: regenerated client (Task 3 regen included Task 1's endpoints — check `src/api/generated/sdk.gen.ts` for the exact function names, `settingsController*`), `unwrap` from `../unwrap`, existing form/toast idioms.
- Produces: `/settings` admin page editing the three values in dollars.

- [ ] **Step 1: Hooks**

`ecommerce-admin/src/api/hooks/settings.ts` (adjust the two generated function names to what `sdk.gen.ts` actually exports):

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  settingsControllerGetShipping,
  settingsControllerUpdateShipping,
} from '../generated/sdk.gen';
import type { UpdateShippingSettingsDto } from '../generated/types.gen';
import { unwrap } from '../unwrap';

export function useShippingSettings() {
  return useQuery({
    queryKey: ['settings', 'shipping'],
    queryFn: () => unwrap(settingsControllerGetShipping()),
  });
}

export function useUpdateShippingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateShippingSettingsDto) =>
      unwrap(settingsControllerUpdateShipping({ body })),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['settings', 'shipping'] }),
  });
}
```

- [ ] **Step 2: Failing page test**

`ecommerce-admin/src/pages/settings/SettingsPage.test.tsx` (mirror the mock style of an existing page test, e.g. `src/pages/orders/OrdersPage.test.tsx` — mock the hooks module, not fetch):

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useShippingSettingsMock = vi.fn();
const mutateMock = vi.fn();
vi.mock('@/api/hooks/settings', () => ({
  useShippingSettings: () => useShippingSettingsMock(),
  useUpdateShippingSettings: () => ({ mutate: mutateMock, isPending: false }),
}));

import { SettingsPage } from './index';

beforeEach(() => {
  vi.clearAllMocks();
  useShippingSettingsMock.mockReturnValue({
    data: {
      freeShippingThresholdCents: 6500,
      standardShippingCents: 999,
      expeditedShippingCents: 1499,
    },
    isLoading: false,
    error: null,
  });
});

describe('SettingsPage', () => {
  it('shows the stored values in dollars', () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText('Free shipping threshold (CAD)')).toHaveValue(65);
    expect(screen.getByLabelText('Standard shipping fee (CAD)')).toHaveValue(9.99);
    expect(screen.getByLabelText('Expedited shipping fee (CAD)')).toHaveValue(14.99);
  });

  it('submits the edited values as cents', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const standard = screen.getByLabelText('Standard shipping fee (CAD)');
    await user.clear(standard);
    await user.type(standard, '10.49');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    expect(mutateMock.mock.calls[0][0]).toEqual({
      freeShippingThresholdCents: 6500,
      standardShippingCents: 1049,
      expeditedShippingCents: 1499,
    });
  });

  it('rejects negative values', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const standard = screen.getByLabelText('Standard shipping fee (CAD)');
    await user.clear(standard);
    await user.type(standard, '-1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/must be 0 or more/i)).toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
```

Run: `cd ecommerce-admin && npx vitest run src/pages/settings/SettingsPage.test.tsx` — Expected: FAIL.

- [ ] **Step 3: Implement the page**

`ecommerce-admin/src/pages/settings/index.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useShippingSettings,
  useUpdateShippingSettings,
} from '@/api/hooks/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const dollars = z.coerce
  .number<number>()
  .min(0, 'Must be 0 or more')
  .max(10000, 'Too large')
  .refine((v) => Math.round(v * 100) === v * 100, 'Max 2 decimals');

const formSchema = z.object({
  freeShippingThreshold: dollars,
  standardShippingFee: dollars,
  expeditedShippingFee: dollars,
});
type FormValues = z.infer<typeof formSchema>;

const toCents = (v: number) => Math.round(v * 100);

export function SettingsPage() {
  const { data, isLoading, error } = useShippingSettings();
  const update = useUpdateShippingSettings();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: data
      ? {
          freeShippingThreshold: data.freeShippingThresholdCents / 100,
          standardShippingFee: data.standardShippingCents / 100,
          expeditedShippingFee: data.expeditedShippingCents / 100,
        }
      : undefined,
  });

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error) return <div className="text-destructive">Failed to load settings.</div>;

  function onSubmit(values: FormValues) {
    update.mutate(
      {
        freeShippingThresholdCents: toCents(values.freeShippingThreshold),
        standardShippingCents: toCents(values.standardShippingFee),
        expeditedShippingCents: toCents(values.expeditedShippingFee),
      },
      {
        onSuccess: () => toast.success('Shipping settings saved'),
        onError: () => toast.error('Could not save settings'),
      },
    );
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Shipping fees are charged at Stripe checkout. Orders at or above the
        threshold get free standard shipping; expedited is always charged.
      </p>
      <form
        onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
        className="mt-6 grid gap-4"
        noValidate
      >
        {(
          [
            ['freeShippingThreshold', 'Free shipping threshold (CAD)'],
            ['standardShippingFee', 'Standard shipping fee (CAD)'],
            ['expeditedShippingFee', 'Expedited shipping fee (CAD)'],
          ] as const
        ).map(([field, label]) => (
          <div key={field} className="grid gap-2">
            <Label htmlFor={field}>{label}</Label>
            <Input
              id={field}
              type="number"
              step="0.01"
              min="0"
              {...form.register(field)}
            />
            {form.formState.errors[field] && (
              <p className="text-sm text-destructive">
                {form.formState.errors[field]?.message}
              </p>
            )}
          </div>
        ))}
        <div>
          <Button type="submit" disabled={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}
```

Register: in `App.tsx` add `import { SettingsPage } from '@/pages/settings';` and `<Route path="settings" element={<SettingsPage />} />` beside the other routes; in `AppShell.tsx` append `{ to: '/settings', label: 'Settings' }` to `NAV`.

- [ ] **Step 4: Run tests**

Run: `cd ecommerce-admin && npx vitest run src/pages/settings/SettingsPage.test.tsx` — Expected: PASS (3 tests).
Run: `npm run lint && npm test` — Expected: clean, PASS.

- [ ] **Step 5: Commit**

```bash
git add ecommerce-admin/src
git commit -m "Admin: shipping-fee settings page"
```

---

### Task 8: Full verification sweep

**Files:** none new.

- [ ] **Step 1: All three suites + builds**

Run (expect PASS on all):
```bash
cd ecommerce-api && npm test && npm run build
cd ../ecommerce-storefront && npm test
cd ../ecommerce-admin && npm test && npm run build
```
Then, with the dev stack STOPPED (`./stop-stack.sh` — never build while `next dev` runs):
```bash
cd ecommerce-storefront && NEXT_PUBLIC_API_URL=http://localhost:3002 npm run build
```
Restart the stack afterwards (`./start-stack.sh`, PATH needs `/opt/homebrew/opt/openjdk/bin`).

- [ ] **Step 2: Manual smoke (stack running, test env)**

- Admin http://localhost:5174 → Settings: values load (65 / 9.99 / 14.99), change standard to 10.49, save, reload — persists. Change back.
- Storefront http://localhost:3005: header has NO currency switcher; all prices CAD.
- Cart with items, signed in: "Ship to" section lists saved addresses, first preselected; Add address dialog works (autocomplete included).
- Checkout click: if the local Stripe key is a real test key, verify Stripe's page shows the prefilled address + both shipping options with correct prices (and free standard at $65+). If the key is the placeholder, a clean 502 toast is the expected behavior — note it and verify the session params via the API log instead.

- [ ] **Step 3: Deployment note**

Confirm in the report (no action): production Supabase requires `npx prisma migrate deploy` for the two new migrations before the next API deploy.

- [ ] **Step 4: Straggler check**

```bash
git status --short
```
Expected: clean.
