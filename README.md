# ecommerce-api

NestJS + Prisma + Postgres backend for the ecommerce platform. Owns all data
and all Stripe interaction. The Next.js storefront and React admin portal are
pure API clients.

## Local development

```bash
docker compose up -d db        # Postgres 16 on :5432
cp .env.example .env           # fill in Stripe + Firebase values
npx prisma migrate dev
npm run start:dev              # API on :3001, Swagger at /docs
```

## Stripe webhooks locally

```bash
stripe listen --forward-to localhost:3001/webhooks/stripe
# copy the whsec_... it prints into .env as STRIPE_WEBHOOK_SECRET
```

## Granting admin access

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run grant-admin -- you@example.com
```

## Tests

```bash
npm test          # unit tests (no DB needed)
npm run test:e2e  # integration tests against ecommerce_test DB
```

## Local admin development

To run the admin SPA against a local emulator:

```bash
cd ../ecommerce-admin && npm run emulators  # Terminal 1
cd ../ecommerce-api
npm run seed:emulator  # Admin: admin@example.com / password123
npm run seed:demo      # Demo catalog + orders
PORT=3002 npm run start:dev  # Terminal 2 (emulator uses :3001, admin on :5174)
```

## Key invariants

- Prices are integer cents; currency is USD.
- Stock decrements happen in the `checkout.session.completed` webhook,
  guarded so they can never go negative; refunds restore stock.
- Webhooks are idempotent: the dedup row and side effects share a transaction.
- Order status: PENDING → PAID → SHIPPED → DELIVERED (+ CANCELLED, REFUNDED).
