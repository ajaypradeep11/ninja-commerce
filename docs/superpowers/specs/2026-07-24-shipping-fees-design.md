# Shipping fees + admin settings, CAD-only storefront

**Date:** 2026-07-24
**Branch:** to be created from master
**Status:** Approved

## Goal

Charge shipping at checkout — $9.99 standard / $14.99 expedited below a $65
free-shipping threshold — with all three values editable from the admin
portal. Simultaneously hide USD: the storefront becomes CAD-only.

## Decisions made

- **CAD-only, plumbing kept:** the header currency switcher is removed and
  every price renders/bills in CAD. `priceUsdCents`, the checkout `currency`
  param, admin USD fields, and the storefront currency lib stay in place but
  dormant. Any stored USD preference is ignored (forced to CAD). No
  migration, no client-facing API change.
- **Above threshold:** Standard becomes Free; Expedited stays paid.
- **Threshold basis:** post-coupon merchandise subtotal (what the customer
  actually pays for goods), in cents, compared to `freeShippingThresholdCents`.
- **Storage:** singleton `StoreSettings` row (not key-value, not env).
- **Ottawa local delivery:** out of scope (copy exists; logic intentionally
  not built).
- **Shipping-page copy:** unchanged — it says rates are calculated at
  checkout, so admin edits never stale it.

## Changes

### 1. API (`ecommerce-api`)

**Schema** — new model + migration:

```prisma
model StoreSettings {
  id                         Int      @id @default(1)
  freeShippingThresholdCents Int      @default(6500)
  standardShippingCents      Int      @default(999)
  expeditedShippingCents     Int      @default(1499)
  updatedAt                  DateTime @updatedAt
}
```

Read path uses an upsert-on-miss helper so a missing row never 500s:
`getShippingSettings()` returns the row, creating it with defaults if absent.

**Settings module** (`src/settings/`): `SettingsService` +
`SettingsController`:
- `GET /admin/settings/shipping` (admin guard) → `ShippingSettingsDto`
  `{ freeShippingThresholdCents, standardShippingCents, expeditedShippingCents }`
- `PUT /admin/settings/shipping` (admin guard, body = same three fields) —
  validation: `@IsInt() @Min(0)` each, `@Max(1_000_000)` sanity cap.
  Returns the updated DTO.

**Checkout** (`checkout.service.ts`): after computing the discounted
merchandise subtotal, fetch settings and add to the Stripe session:

```ts
shipping_options: [
  shippingRate('Standard (4-7 business days)', qualifiesForFree ? 0 : s.standardShippingCents, 4, 7),
  shippingRate('Expedited (2-4 business days)', s.expeditedShippingCents, 2, 4),
]
```

where `shippingRate(name, amountCents, minDays, maxDays)` builds
`{ shipping_rate_data: { display_name, type: 'fixed_amount',
fixed_amount: { amount, currency: <session currency lowercased> },
tax_behavior: 'exclusive', delivery_estimate: { minimum/maximum in
business_day units } } }`. `qualifiesForFree` =
`discountedSubtotalCents >= freeShippingThresholdCents`.
The dormant USD path (API still accepts `currency: 'USD'`) applies the same
numeric amounts in USD — acceptable because the storefront no longer sends
USD.

### 2. Storefront (`ecommerce-storefront`)

- Remove `CurrencySwitcher` from the header (delete component + its test;
  the underlying `currency` lib and cart currency handling stay).
- Force CAD: wherever the active currency preference is resolved
  (lib/cookie/localStorage), always resolve to `'CAD'`; checkout always
  sends `currency: 'CAD'`. Stored `USD` preferences are ignored.
- No copy changes.

### 3. Admin (`ecommerce-admin`)

- Regenerate client (`npm run generate:api`) after API changes.
- New **Settings** page `src/pages/settings/` + nav entry: form with three
  dollar-denominated inputs (Free shipping threshold, Standard fee,
  Expedited fee) converting to/from cents, RHF + zod (non-negative numbers,
  max 2 decimals), TanStack Query hooks (`useShippingSettings`,
  `useUpdateShippingSettings`), save button with success/error toast —
  matching existing page/form patterns (e.g. coupons).

## Testing

- API: settings service (default-row creation, update), controller guard
  wiring; checkout spec — below threshold (9.99/14.99), at/above threshold
  (0/14.99), threshold uses post-coupon subtotal, rates carry
  `tax_behavior: 'exclusive'` and the session currency.
- Storefront: header renders without the switcher; checkout body always
  `currency: 'CAD'` even with a stored USD preference.
- Admin: settings page loads values, converts dollars↔cents, submits, shows
  validation errors.
- Manual: full-stack smoke — cart under $65 shows both paid options at
  Stripe checkout; over $65 shows free standard; change fees in admin and
  see the new values at checkout.

## Out of scope

- Ottawa local delivery logic.
- Removing USD plumbing (columns, params, libs).
- Per-currency shipping settings.
- Shipping-page copy edits.
