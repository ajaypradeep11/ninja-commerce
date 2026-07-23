# Dual CAD/USD pricing

**Date:** 2026-07-22
**Scope:** All three sub-projects — `ecommerce-api` (schema, checkout),
`ecommerce-admin` (product form, bulk upload, money formatting),
`ecommerce-storefront` (currency state, price rendering, switcher, cart).

## Goal

Sell in Canadian and US dollars. An admin enters both prices explicitly on each product;
a shopper picks a currency on the storefront and every price re-renders in it; Stripe
charges in the currency the shopper chose.

Prices are entered by hand, not converted at runtime. There is no FX rate lookup in the
request path, no rounding rules to maintain, and no drift between what the shopper sees
and what the card is billed. A rate constant exists only to seed the admin's autofill
button, which produces an editable suggestion.

Two currencies, two shipping countries (CA, US). Nothing else.

## Decisions

| Question | Decision |
|---|---|
| What does Stripe charge in USD mode? | Real USD. The session's currency and `unit_amount` are the USD price. |
| Product missing a USD price? | Not allowed. Both prices are required. |
| How does admin fill USD quickly? | An **Autofill from CAD** button — one click, editable result. Not automatic. |
| Where is currency stored? | A cookie. URLs are unchanged. |
| Shipping countries | `['CA', 'US']`. Worldwide/international copy is removed. |
| FIXED-amount coupons | CAD carts only; rejected with a clear message on USD carts. PERCENT works in both. |

### Why a cookie and not a URL prefix

A Shopify-style `/us/...` prefix is shareable and cacheable per currency, but every route
under `app/(store)` would move into a `[currency]/` segment and every internal link,
redirect, and `next` param would have to carry the prefix. The cookie costs one thing —
pages that show prices become dynamically rendered — and changes no routes. Accepted.

## Design

### 1. Schema (`ecommerce-api/prisma/schema.prisma`)

**Product.** `priceCents` keeps its name and meaning: the CAD price. Add:

```prisma
priceUsdCents Int
```

Renaming `priceCents` to `priceCadCents` would ripple through response DTOs, both
generated clients, admin forms, and the cart's stored line shape for no functional gain.
The name stays; the meaning is documented on the field.

The migration runs three steps so no row is ever null:

1. `ALTER TABLE "Product" ADD COLUMN "priceUsdCents" INTEGER;`
2. Backfill the existing rows from CAD × a rate literal written into the migration,
   rounded to charm pricing (`.99`).
3. `ALTER TABLE "Product" ALTER COLUMN "priceUsdCents" SET NOT NULL;`

The migration's rate is a one-time literal baked into that migration file. It is
deliberately *not* shared with the admin autofill constant (§7): a migration must stay
reproducible forever, so it cannot read a value that changes later. Backfilled prices are
a starting point for the admin to review, not a commitment.

**Order.** Add a currency enum and column:

```prisma
enum Currency { CAD USD }
// on Order:
currency Currency @default(CAD)
```

No other money column changes. `subtotalCents`, `discountCents`, `taxCents`,
`totalCents`, and `OrderItem.priceCents` are all read *in the order's currency*. This is
what keeps order history correct permanently: an order placed in USD renders as USD
forever, with no dependence on a rate that may have moved. Existing orders default to
`CAD`, which is what they were actually charged.

### 2. Checkout (`ecommerce-api/src/checkout/checkout.service.ts`)

- `CreateCheckoutDto` gains a `currency` field validated against the `Currency` enum.
- The module-level `const CURRENCY = 'cad'` becomes per-request.
- `unit_amount` selects `priceCents` or `priceUsdCents` from the product row. As today,
  prices come from the database — the client's numbers are never trusted.
- `Order.currency` is persisted, and `OrderItem.priceCents` snapshots the price in that
  currency.
- The ad-hoc Stripe coupon's `amount_off` currency **must** match the session currency;
  Stripe rejects a mismatch.
- A FIXED coupon on a USD cart fails validation with a clear message
  ("This code is valid on CAD orders only"). PERCENT coupons apply to either.
- `SHIPPING_COUNTRIES` becomes `['CA', 'US']`.

### 3. Admin stats (`ecommerce-api/src/admin`) — no change required

An earlier draft of this spec said `/admin/stats` sums `totalCents` and would therefore
mix currencies. That was wrong. `AdminService.stats()` returns only `ordersToday` (a
count) and `lowStockProducts` (a list) — it touches no money columns at all, so mixing
CAD and USD cannot arise there.

No work is needed in this module. The currency-aware money formatting in admin is still
required, but it belongs to the orders list and order detail screens (§7), not to stats.

### 4. Storefront currency state

A `localninja.currency` cookie holds `CAD` or `USD`, defaulting to `CAD`.

The currency is chosen by the shopper only. There is no geolocation or `Accept-Language`
sniffing: a first-time US visitor sees CAD until they switch. Guessing from IP is a
common source of wrong-currency complaints and would undermine the dynamic-rendering
story below, so it is excluded deliberately rather than overlooked.

Server components read it with `cookies()` from `next/headers`. Reading cookies opts the
route into dynamic rendering, which is precisely what stops a cached page from serving
the wrong currency — the main hazard of the cookie approach.

The switcher lives in the footer, matching where Shopify puts it. It writes the cookie
and calls `router.refresh()` so server-rendered prices re-render. No client-side price
maths, no hydration flicker.

### 5. Price rendering (`ecommerce-storefront`)

`formatCents(cents)` becomes `formatMoney(cents, currency)`, returning `CAD $54.99` and
`USD $39.99`. The currency code is explicit because a bare `$` is ambiguous between the
two currencies actually on offer.

`<Price>` accepts the currency. Product responses carry both prices, and one helper
selects the active one so that choice is not duplicated across the eight files that
render prices.

### 6. Cart (`ecommerce-storefront/src/cart/store.ts`)

Cart lines cache `priceCents` in `localStorage`, so a currency switch would otherwise
leave stale prices in the cart. The stored cart records the currency it was priced in;
when that differs from the active currency, the existing refresh path (`updateLineMeta`,
already used for stock refresh on mount) repulls prices.

This is a display concern only. Checkout re-derives every price server-side from the
database, so a stale cart cannot produce a wrong charge.

### 7. Admin UI (`ecommerce-admin`)

- `product-form.tsx`: CAD and USD fields, both required, plus an **Autofill from CAD**
  button seeded by a rate constant kept in one config module.
- `bulk-upload-dialog.tsx`: the CSV gains a USD price column, required per row.
- `formatUsd()` in the products list and order detail currently formats CAD data as USD —
  the same bug just fixed in the storefront. It becomes currency-aware and shows each
  order in the currency it was charged.

### 8. Policy copy (`ecommerce-storefront`)

The shipping page advertises worldwide shipping, international delivery windows, customs
and duties, and a `$150 CAD` international free-shipping threshold, while checkout has
only ever accepted Canadian addresses. With shipping set to CA and US, that copy is
rewritten to describe Canada and the US only, and `freeShippingInternational` is removed
from `src/lib/site.ts`. The CAD free-shipping threshold gains a USD counterpart.

Note: free shipping is presentational. There are no `shipping_options` on the Stripe
session, so no shipping is ever charged. This spec does not change that; it only makes
the copy consistent per currency.

## Testing

**API.** Checkout builds a CAD session from `priceCents` and a USD session from
`priceUsdCents`; the ad-hoc coupon's currency matches the session; a FIXED coupon on a
USD cart is rejected; `Order.currency` is persisted and snapshotted on items; US shipping
addresses are accepted.

**Storefront.** `formatMoney` in both currencies; the price-selection helper; the cart
repulls prices when the stored currency differs from the active one; the switcher sets
the cookie and triggers a refresh.

**Admin.** Autofill computes from CAD and stays editable; validation blocks a save with
either price missing; bulk upload rejects rows without a USD price; money formatting
follows the order's currency.

## Out of scope

- Currencies beyond CAD and USD, and countries beyond CA and US.
- Live FX rates, automatic conversion, or per-market price adjustment.
- Shopify-style `/en-us` URL prefixes.
- Actually charging for shipping.
- Stripe Adaptive Pricing — this design supersedes it. Adaptive Pricing only converts on
  Stripe's hosted page, which would conflict with the explicit prices set here.
