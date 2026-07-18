# Canada-only shipping + provincial sales tax — design

**Date:** 2026-07-18
**Status:** Approved, ready for implementation

## Goal

Restrict shipping to Canada, charge in CAD, and collect the correct provincial
sales tax (GST/HST/PST/QST) at checkout, computed by Stripe Tax from the
shipping address the customer enters on Stripe's hosted Checkout page.

## Decisions (and why)

- **Currency: CAD.** Prices are re-denominated as CAD cents (a `4999` product is
  now CAD $49.99). Canadian buyers pay in their own currency; tax math is in CAD.
- **Tax engine: Stripe Tax (`automatic_tax`).** The free manual approach
  (`dynamic_tax_rates` with one TaxRate per province) was ruled out because
  Stripe's `dynamic_tax_rates` **does not support Canada** — per the API
  reference it only supports US, GB, AU, and the EU. Stripe Tax supports Canada
  natively (GST/HST/PST/QST), keeps rates current, and itemizes tax per address.
  Cost: ~0.5% per transaction with tax.

## Scope

### API (`ecommerce-api`)

1. **Checkout session** (`src/checkout/checkout.service.ts`):
   - `SHIPPING_COUNTRIES` → `['CA']` (Stripe then offers only Canada + its
     provinces/territories in the address form).
   - `line_items[].price_data.currency` → `'cad'`.
   - `line_items[].price_data.tax_behavior` → `'exclusive'` (tax added on top).
   - Session gains `automatic_tax: { enabled: true }`.
   - `shipping_address_collection.allowed_countries` stays wired to
     `SHIPPING_COUNTRIES` (now `['CA']`).

2. **Order model** (`prisma/schema.prisma`): add `taxCents Int?` to `Order`.
   One migration.

3. **Webhook** (`src/webhooks/webhooks.service.ts`): in the
   `checkout.session.completed` handler, persist `session.total_details.amount_tax
   → taxCents` alongside the existing `session.amount_total → totalCents`. Tax is
   nullable; a session with no tax leaves it null.

4. **Stripe Tax activation**: Stripe Tax must be active on the account (an
   origin/head-office address + at least one CA tax registration) or session
   creation with `automatic_tax` errors. Configure test mode programmatically via
   the Stripe Tax Settings API (`POST /v1/tax/settings`) and Registrations API
   (`POST /v1/tax/registrations`) using the test key. Production setup is a
   manual, owner-performed dashboard step (real business address + registered
   provinces) — documented, not automated.

### Storefront (`ecommerce-storefront`)

- Order success page and account order detail show a **Tax** line between
  Subtotal and Total when `taxCents` is present. Amounts render in CAD via the
  existing `$` formatting.

### Admin (`ecommerce-admin`)

- Order detail shows a **Tax** line between Subtotal and Total when present.

### OpenAPI / generated clients

- Regenerate clients after the DTO gains `taxCents` (`npm run openapi:emit` in
  the API, then `npm run generate:api` in storefront + admin).

## Out of scope (YAGNI)

- No admin UI for tax config, no CRA remittance reports, no tax-exempt handling,
  no per-product tax categories (a single default product tax code is used).

## Testing

- **Unit (API):** checkout session includes `automatic_tax.enabled === true`,
  `currency: 'cad'`, `allowed_countries: ['CA']`, and `tax_behavior: 'exclusive'`;
  webhook persists `taxCents` from `total_details.amount_tax`.
- **Unit (frontends):** Tax line renders when `taxCents` set, hidden when null.
- **E2E:** real browser checkout with an Ontario address — assert 13% HST appears
  on Stripe's page and lands as `taxCents` on the resulting order (against the
  local test DB, with Stripe Tax configured in test mode).

## Rollout notes

- Existing orders have `taxCents = null`; displays simply omit the Tax line.
- Production requires the owner to activate Stripe Tax in the live dashboard
  before Canada tax is collected on real orders.
