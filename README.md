# ecommerce-admin

Admin portal for the ecommerce platform. React 19 + Vite + TypeScript,
Tailwind v4 + shadcn/ui, TanStack Query over a generated OpenAPI client,
Firebase Auth (admin custom claim required).

## Dev loop (four terminals)

    # 1. Postgres (in ecommerce-api)
    docker compose up -d db

    # 2. Firebase emulators (here) — Auth :9098, Storage :9199, UI :4001
    # Emulators need Java: export PATH=/opt/homebrew/opt/openjdk/bin:$PATH
    npm run emulators

    # 3. API (in ecommerce-api) — 3001 is taken on this machine
    PORT=3002 npm run start:dev

    # 4. Admin SPA (here) — http://localhost:5174
    npm run dev

One-time setup after the emulators are up (both in ecommerce-api):

    npm run seed:emulator   # admin@example.com / password123
    npm run seed:demo       # demo catalog + orders

## Regenerating the API client

    # in ecommerce-api: refresh openapi.json
    npm run openapi:emit
    # here: regenerate src/api/generated
    npm run generate:api

## Tests

    npm test

## Production notes (Phase 2 does not deploy)

- Set real `VITE_FIREBASE_*` values and `VITE_USE_EMULATORS=false`.
- `storage.rules` is wide open for authed users — lock down before deploying.
- Grant the admin claim with ecommerce-api's `npm run grant-admin -- <email>`.
