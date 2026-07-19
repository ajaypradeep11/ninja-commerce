# Order cancellation (customer + admin) — design

**Date:** 2026-07-18 · **Status:** Approved.

## Goal

Let a customer cancel their own order before it ships, and let an admin cancel
too. Cancelling a paid order refunds the customer.

## Decisions

- Cancellable statuses: **PENDING** and **PAID** (pre-shipping). SHIPPED /
  DELIVERED / CANCELLED / REFUNDED → 409.
- A cancelled **PAID** order → issue a Stripe refund → status becomes **REFUNDED**
  via the existing `charge.refunded` webhook (stock restored there). Reuses the
  refund path; no new status.
- A cancelled **PENDING** (unpaid) order → **CANCELLED** (+ best-effort expire the
  Stripe Checkout session so it can't be paid late).

## API — `POST /orders/:id/cancel`

Auth: the order **owner or an admin** (global auth guard + in-service ownership
check; NOT admin-only). `orders.service.ts#cancel(id, requester)`:
1. Load order; 404 if missing; 403 if not owner and not admin.
2. If status ∉ {PENDING, PAID} → 409 "Order can no longer be cancelled".
3. **PENDING**: best-effort `checkout.sessions.expire`; then guarded
   `updateMany({ id, status: PENDING } → CANCELLED)`. If the guard matched, return
   `{ status: 'CANCELLED' }`. If it didn't (raced to PAID), fall through to refund.
4. **PAID**: `stripe.refunds.create({ payment_intent })` → return
   `{ status: 'PAID', refundId }` (status flips to REFUNDED asynchronously via the
   webhook, which also restores stock).

Response DTO: `OrderCancelResponseDto { status, refundId? }`.

## Storefront

Account order-detail page gains a client `CancelOrderButton` shown when status is
PENDING or PAID: confirm → call cancel → if `refundId` present, show "refund
processing…" and poll/refresh until REFUNDED; else the order shows CANCELLED.

## Admin

`availableOrderActions` gains `canCancel` (true for PENDING/PAID). Order-detail
adds a **Cancel** button (confirm dialog) calling the same endpoint — covers
cancelling unpaid PENDING orders and paid orders (→ refund). The existing
**Refund** button stays for post-shipping refunds/returns.

## Testing

- **API unit**: owner cancels PENDING → session expired + CANCELLED, no refund;
  owner cancels PAID → refund created, refundId returned; non-owner non-admin →
  403; SHIPPED → 409; admin cancels another user's order.
- **Storefront/admin unit**: cancel button visibility by status; cancel invokes
  the endpoint; refund-pending state shown for paid cancels.
- Regenerate OpenAPI clients (new endpoint + DTO).
