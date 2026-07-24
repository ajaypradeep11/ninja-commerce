# Canada-only shipping + Canada Post address autocomplete

**Date:** 2026-07-23
**Branch:** feat/dual-currency
**Status:** Approved

## Goal

Restrict the store to shipping within Canada only, and add Canada Post
AddressComplete autocomplete to the saved-address form so typing an address
suggests real Canadian addresses and fills the fields on selection.

Dual currency (CAD/USD) stays: shoppers may still view and pay in USD; only
shipping destinations become Canada-only.

## Decisions made

- **Scope:** Canada-only everywhere — Stripe checkout, site copy, and the
  saved-address form.
- **Lookup provider:** Canada Post AddressComplete REST API (Find + Retrieve),
  called client-side from a custom themed combobox — not the official JS
  widget (clashes with the six-theme system) and not a backend proxy
  (AddressComplete keys are domain-restricted and designed for client use).
- **API key:** not available yet. Everything is wired behind
  `NEXT_PUBLIC_ADDRESSCOMPLETE_KEY`; with no key set, the form degrades to
  plain typing with no errors.

## Changes

### 1. Canada-only sweep

- `ecommerce-api/src/checkout/checkout.service.ts` — `SHIPPING_COUNTRIES`
  becomes `['CA']`. Update `checkout.service.spec.ts` (two assertions expect
  `'US'` in `allowed_countries`).
- `ecommerce-storefront/src/app/(store)/shipping/page.tsx` — remove the
  "Shipping to the United States" section; copy covers Canada only.
- Other `'US'` literals in API tests (`webhooks.service.spec.ts`,
  `app.e2e-spec.ts`) are billing-country fixtures, not shipping policy —
  leave them.
- Currency switcher (`CurrencySwitcher.tsx`) untouched.

### 2. Address form (`ecommerce-storefront/src/components/site/AddressManager.tsx`)

- **Country:** input removed; a fixed read-only "Canada" is displayed and the
  schema hardcodes `country: 'CA'` (the `AddressDto` sent to the API is
  unchanged in shape).
- **State → Province:** label change; field stays optional free text
  (autocomplete fills the two-letter province code).
- **Postal code:** validated as Canadian format — regex
  `/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/`, normalized on submit to
  `A1A 1A1` (uppercase, single space).
- **Line 1 autocomplete:**
  - Typing ≥ 3 characters triggers a debounced (~250 ms) `Find` call.
  - Suggestions render in a dropdown styled with existing theme tokens
    (same idiom as other popovers in the app), keyboard-navigable
    (ArrowUp/ArrowDown/Enter/Escape).
  - Selecting a suggestion whose `Next` is `Find` (e.g. an apartment
    building) drills in with another `Find` using `LastId`.
  - Selecting a final address calls `Retrieve` and fills line1, line2, city,
    province, postalCode. All fields remain editable afterward.
  - Fetch errors, empty results, or a missing key → dropdown simply doesn't
    appear; typing is never blocked and the form is always submittable.

### 3. New module `ecommerce-storefront/src/lib/addresscomplete.ts`

Typed client for the AddressComplete JSON endpoints:

- `findAddresses(searchTerm, lastId?)` →
  `Interactive/Find/v2.10/json3.ws` with `Key`, `SearchTerm`, `Country=CAN`,
  `LastId` — returns `{ id, text, description, next: 'Find' | 'Retrieve' }[]`.
- `retrieveAddress(id)` → `Interactive/Retrieve/v2.11/json3.ws` — returns
  `{ line1, line2?, city, province, postalCode }` (from the response row
  whose `Language` is `ENG`).
- Reads `NEXT_PUBLIC_ADDRESSCOMPLETE_KEY`; both functions return empty/null
  when the key is unset. AddressComplete error payloads (`Error` field in
  items) are treated as empty results.
- Exact endpoint URLs/versions to be verified against current Canada Post
  docs during implementation.

## Testing

- `addresscomplete.ts` unit tests with mocked `fetch`: query building,
  response mapping, error/no-key behavior.
- `AddressManager` form tests: postal-code validation, country fixed to CA,
  suggestion selection fills fields (mocked client module).
- API: updated `checkout.service.spec.ts` assertions (`['CA']`).
- Manual: run storefront, type a Canadian address, confirm fill (once a key
  exists; until then confirm silent degrade).

## Out of scope

- Checkout address collection (stays on Stripe's hosted page).
- Removing USD / the currency switcher.
- Backend proxying of AddressComplete calls.
