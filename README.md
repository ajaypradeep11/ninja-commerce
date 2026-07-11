# ecommerce-storefront

The customer-facing storefront of a three-repo Stripe/Firebase ecommerce
platform: this Next.js app (browsing, cart, checkout, account) is a pure API
client of [`ecommerce-api`](../ecommerce-api) (NestJS + Prisma + Postgres,
owns all data and Stripe interaction), which also serves
[`ecommerce-admin`](../ecommerce-admin) (the internal ops SPA). All three
repos live as siblings on disk and are expected to be checked out next to
each other.

## Prereqs

- Node 20+
- Docker (Postgres for the API)
- Java (for the Firebase emulator suite — `export PATH=/opt/homebrew/opt/openjdk/bin:$PATH` if `firebase emulators:start` can't find a JDK)
- Sibling checkouts of `ecommerce-api` and `ecommerce-admin` (the admin repo owns the emulator config used by all three apps)

## Run locally — five terminals

```bash
# 1. Postgres + migrations + demo catalog/orders
cd ecommerce-api && docker compose up -d db && npx prisma migrate dev && npm run seed:demo

# 2. Firebase Auth emulator (auth :9098, emulator UI :4001)
cd ecommerce-admin && npm run emulators

# 3. API
cd ecommerce-api && PORT=3002 npm run start:dev

# 4. Storefront
cd ecommerce-storefront && npm run dev            # http://localhost:3000
# Port 3000 already taken? Override it: PORT=3005 npm run dev
# (the app still reads NEXT_PUBLIC_API_URL etc. from .env.development regardless of port)

# 5. (optional, for a real end-to-end checkout) Stripe CLI
stripe listen --forward-to localhost:3002/webhooks/stripe
```

The admin SPA (`ecommerce-admin`, :5174) isn't needed to work on the
storefront but is harmless to leave running alongside it — terminal 2's
emulator is shared infrastructure, not the admin app itself.

## Environment

Copy `.env.example` to `.env.local` for anything you want to override, or
just rely on the committed defaults:

- `.env.development` — used by `npm run dev` / `npm test`: points at the
  local API (`http://localhost:3002`) and the Firebase Auth emulator
  (`NEXT_PUBLIC_USE_EMULATORS=true`).
- `.env.production` — placeholders only. A real deployment **must** override
  every value via the hosting platform's environment; a runtime guard
  (`src/auth/firebase.ts`) refuses to boot against leaked placeholder
  Firebase config in production.
- `NEXT_PUBLIC_SUCCESS_TIMEOUT_MS` — how long the success page polls for the
  order to appear before giving up (default 60000ms).

## Theming

Six built-in themes (everloom, noir, meadow, arcade, atelier, ninja) are
switchable live from the footer. Set the default with `NEXT_PUBLIC_THEME`,
hide the switcher with `NEXT_PUBLIC_SHOW_THEME_SWITCHER=false`, or add your
own theme with one CSS block + one registry entry — see [THEMING.md](./THEMING.md).

## Tests

```bash
npm test                                    # Vitest unit/component suite
npm run build                               # production build
npm run dev                                 # start the app (see above), then in another terminal:
BASE_URL=http://localhost:3005 npm run e2e  # Playwright e2e — BASE_URL defaults to :3000
```

`playwright.config.ts` intentionally has no `webServer` block — it drives
whatever stack (Postgres, seeded API, auth emulator, `next dev`) is already
running, so start everything yourself first per the five-terminal loop above.

A bare `npm run build` fails with `Failed to parse URL from /categories`: the
home page fetches categories server-side at build time, and `.env.production`'s
`NEXT_PUBLIC_API_URL` is intentionally blank (see Environment, above). Build
against a running local API instead:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3002 npm run build
```

## Regenerating the API client

The typed API client under `src/api/generated` is committed, not built on
the fly. Regenerate and commit it whenever the API contract changes:

```bash
cd ../ecommerce-api && npm run openapi:emit   # refreshes ecommerce-api's openapi.json
cd ../ecommerce-storefront && npm run generate:api
```

## Stripe

The committed API `.env` ships a placeholder `STRIPE_SECRET_KEY`
(`sk_test_replace_me`). Against that placeholder, clicking "Checkout" fails
cleanly by design: the API returns a 502, the storefront shows a "Checkout
failed. Try again." toast, the cart is left intact, and the order is flipped
to `CANCELLED` server-side. This is expected local behavior, not a bug.

For a real end-to-end checkout (Stripe hosted Checkout → webhook → order
`PAID`):

1. Put a real `sk_test_...` key in `ecommerce-api/.env` as `STRIPE_SECRET_KEY`.
2. Run `stripe listen --forward-to localhost:3002/webhooks/stripe` and copy
   the printed `whsec_...` into `ecommerce-api/.env` as `STRIPE_WEBHOOK_SECRET`.
3. Restart the API. Checkout now redirects to `checkout.stripe.com`; use a
   [Stripe test card](https://docs.stripe.com/testing) to complete payment.

## Brand

Site name, tagline, copy, and USPs live in one place:
[`src/lib/site.ts`](src/lib/site.ts). Renaming the brand or swapping the
tagline/USP copy only requires editing that file.

## Production notes (this phase does not deploy)

Target is Firebase App Hosting for this app. Before deploying: point
`NEXT_PUBLIC_API_URL` at the deployed API, use a real Firebase project's
config (and drop `NEXT_PUBLIC_USE_EMULATORS`), add real Stripe keys and a
webhook endpoint on the deployed API, wire up the Google sign-in button, and
swap the picsum.photos seed images for real product photography. Consider
`revalidate: 60` (ISR) on catalog pages once acceptable stock-display
staleness is decided.
