# Coupon codes — design

**Date:** 2026-07-19
**Scope:** API + admin + storefront. User-approved direction: own coupon system, entered in
our cart, enforced per Firebase customer ("proceed" with recommended defaults).

## Rules

- A coupon has a unique code (stored uppercase), a discount (`PERCENT` 1–100 or `FIXED`
  cents), and an `active` flag.
- **One coupon per purchase** — a single optional `couponCode` on checkout.
- **Once per customer** — a `CouponRedemption` row per (coupon, user) with a unique
  constraint; enforced at session creation, recorded in the payment webhook.
- Discount math (server-side only): `PERCENT` → `floor(subtotal * value / 100)`;
  `FIXED` → `min(value, subtotal)`. Applied to the Stripe session as an ad-hoc
  `amount_off` coupon (`duration: 'once'`), so Stripe Tax computes tax on the discounted
  amount and Stripe reports the true totals.
- Stripe forbids `discounts` together with `allow_promotion_codes`, so the existing
  `allow_promotion_codes: true` is removed — our cart field is the only coupon entry.

## Data model (Prisma)

`Coupon { id, code @unique, type: DiscountType, value Int, active Boolean, timestamps }`
`CouponRedemption { id, couponId, userId, orderId @unique, createdAt, @@unique([couponId, userId]) }`
`Order` gains `couponCode String?`, `discountCents Int?`.

## API

- `POST /coupons/validate` (authed customer): `{ code, subtotalCents }` →
  `{ code, type, value, discountCents }`. Errors: 404 invalid/inactive code, 409 already
  redeemed by this user.
- Admin CRUD: `GET /coupons` (with redemption counts), `POST`, `PATCH /:id`,
  `DELETE /:id` (409 if it has redemptions — deactivate instead).
- Checkout: `CreateCheckoutDto.couponCode?` — re-validated inside `createSession`
  (never trust the client's discount); order stores `couponCode` + `discountCents`.
- Webhook `checkout.session.completed`: creates the `CouponRedemption` inside the
  existing idempotent transaction; a duplicate (P2002, e.g. two racing sessions by the
  same user) is logged and tolerated — the order is still honored.

## Admin

Coupons page (nav: **Coupons**): create form (code, type, value, active), list with
discount display, redemption count, active toggle, delete. Hooks mirror categories/brands.

## Storefront

Cart page summary gains a coupon field: input + Apply → `POST /coupons/validate` →
shows `Coupon CODE −$X.XX` line and adjusted total, with Remove. Applied code passes
through `CheckoutButton` into the checkout DTO. Signed-out users are told to sign in to
apply a code (validate is authed). Checkout errors for a stale coupon surface as toasts.
Account order rows show the discount when present.

## Testing

API unit tests: coupon validation math + error paths, checkout passes `discounts` and no
`allow_promotion_codes`, webhook records redemption idempotently. Admin page test.
Storefront suite stays green. Browser verification of the full flow (apply, wrong code,
reuse rejection) minus real payment (Stripe placeholder key → 502 by design locally).

## Out of scope

Stacking multiple coupons, expiry dates, minimum order amounts, per-code global
redemption caps, Stripe-dashboard-managed promotion codes.
