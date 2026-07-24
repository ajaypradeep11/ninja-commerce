# Shipping fees + admin settings, cart address selection, CAD-only storefront

**Date:** 2026-07-24
**Branch:** feat/shipping-fees
**Status:** Approved

## Goal

Charge shipping at checkout — $9.99 standard / $14.99 expedited below a $65
free-shipping threshold — with all three values editable from the admin
portal. Let the shopper pick a saved shipping address on the cart page and
have Stripe's checkout arrive with it pre-filled. Simultaneously hide USD:
the storefront becomes CAD-only.

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
- **Address prefill mechanism (verified against Stripe docs):** hosted
  Checkout prefills shipping fields when the session is created with an
  existing `customer` whose `shipping` is set and the address is within
  `shipping_address_collection.allowed_countries`. The fields stay editable
  on Stripe's page. This requires storing a `stripeCustomerId` per user
  (replaces `customer_email` on the session — Stripe forbids passing both).
- **Cart UX:** saved addresses render as selectable cards on the cart page
  with an inline "Add address" dialog (reusing the account form incl.
  Canada Post autocomplete). Selecting is optional — with none selected,
  checkout behaves as today (shopper types the address at Stripe).
- **Addresses have no ids** (Json array on User), so the checkout request
  carries the full selected address object, validated server-side.

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

### 2. Cart address selection + Stripe prefill

**Schema** — `User` gains `stripeCustomerId String? @unique` (migration,
nullable — created lazily).

**Checkout API** — `CreateCheckoutDto` gains optional
`shippingAddress?: AddressDto` (nested validation, country must be `CA`).
When present, `createSession`:
1. Gets-or-creates the user's Stripe customer (`stripeCustomerId` on User;
   create with `email`, persist id; on Stripe "No such customer" — e.g. key
   switched between test/live — create a fresh one and overwrite).
2. Updates the customer's `shipping` to
   `{ name: address.name ?? user.email, address: { line1, line2, city,
   state, postal_code, country } }`.
3. Creates the session with `customer: <id>` instead of `customer_email`,
   keeping `shipping_address_collection` → Stripe prefills, shopper can
   still edit. Without a `shippingAddress`, the session keeps using
   `customer_email` exactly as today.
The PENDING order is unaffected — the webhook still snapshots whatever
address the session completes with (source of truth stays Stripe).

**Cart page** (`app/(store)/cart/page.tsx`) — signed-in shoppers with items
see a "Ship to" section above the checkout button: saved addresses as
selectable cards (radio semantics, first address preselected), an "Add
address" button opening the same dialog/form as the account page (Canada
Post autocomplete included — extract the form from `AddressManager` for
reuse rather than duplicating it), and the selected address rides along on
the checkout POST. Signed-out or empty-cart states unchanged.

### 3. Storefront CAD-only (`ecommerce-storefront`)

- Remove `CurrencySwitcher` from the header (delete component + its test;
  the underlying `currency` lib and cart currency handling stay).
- Force CAD: wherever the active currency preference is resolved
  (lib/cookie/localStorage), always resolve to `'CAD'`; checkout always
  sends `currency: 'CAD'`. Stored `USD` preferences are ignored.
- No copy changes.

### 4. Admin (`ecommerce-admin`)

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
  `tax_behavior: 'exclusive'` and the session currency; address path —
  customer created once then reused, `customer` replaces `customer_email`,
  customer `shipping` updated per checkout, no-address path unchanged,
  non-CA shippingAddress rejected 400.
- Storefront: header renders without the switcher; checkout body always
  `currency: 'CAD'` even with a stored USD preference; cart address cards
  render/select/preselect, add-address dialog reuses the shared form,
  selected address included in the checkout POST (and absent when none).
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
