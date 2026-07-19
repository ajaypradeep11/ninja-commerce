# Brands ("Anime" tags) — design

**Date:** 2026-07-19
**Scope:** all three apps (API, admin, storefront) + demo seed.

## Goal

Products are franchise merch (Attack on Titan, Call of Duty, Tokyo Ghoul, BT21, Chainsaw Man,
Naruto). Admins need to manage these franchises as **Brands** and tag products with them;
shoppers need to browse by brand. The storefront labels the concept **"Anime"**.

## Data model (ecommerce-api)

```prisma
model Brand {
  id        String    @id @default(cuid())
  name      String
  slug      String    @unique
  sortOrder Int       @default(0)
  products  Product[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

`Product` gains `brand Brand? @relation(..., onDelete: SetNull)`, `brandId String?`,
`@@index([brandId])`. Brand is **optional** — non-franchise products stay untagged. Deleting
a brand un-tags its products (SetNull), never blocks or cascades.

## API

- New `src/brands/` module mirroring `src/categories/`:
  - `GET /brands` — public, sorted by `sortOrder` then `name`.
  - `POST /brands`, `PATCH /brands/:id`, `DELETE /brands/:id` — admin-guarded.
  - DTOs mirror category DTOs (name, slug, sortOrder).
- Products:
  - `CreateProductDto` / `UpdateProductDto` gain optional nullable `brandId` (null clears).
  - Product responses include the `brand` relation (nullable).
  - `GET /products` gains optional `brand` (slug) query param, combinable with
    `category`/`q`/`sort`/`page`; manual `@ApiQuery` like the others.
- `npm run openapi:emit`, then both frontends `npm run generate:api`.

## Admin (ecommerce-admin)

- `src/api/hooks/brands.ts` mirroring the categories hooks (list + create/update/delete
  mutations with invalidation).
- `src/pages/brands/` page cloned from `src/pages/categories/` (list, add, rename,
  sort-order, delete), with router entry and nav link labeled **Brands**.
- Product form: optional **Brand** select (default "None") sending `brandId`
  (null when cleared). Product list/table may show the brand name.
- Tests cloned from the categories page tests.

## Storefront (ecommerce-storefront)

- **Hamburger menu**: `Header` becomes an async server component fetching brands
  (`brandsControllerFindAll` + `serverFetchOptions`) and passing them to `HeaderMenu`,
  which renders an **Anime** group under Shop/About/FAQ — each brand links to
  `/products?brand=<slug>`.
- **Shop page** (`/products`): parses `brand` param; passes it to the API; unknown brand
  slug → `notFound()`. `ListingControls` gains a second chip row for brands (All + each
  brand). Heading: active category wins; else active brand name; else search/Shop all.
  Pagination already passes searchParams through, preserving the filter.
- **Home page**: an "ANIME" chip strip (same short-chip style as the category strip)
  linking to the filtered shop; fetched in the same `Promise.all`.

## Demo seed

`seed:demo` upserts the six brands and tags demo products by name-matching
(e.g. product names containing "Attack on Titan" → that brand). Stays idempotent.

## Testing

- API: `brands.service.spec.ts` mirroring `categories.service.spec.ts`; products service
  spec gains a brand-filter case. `npm test` (no DB needed).
- Admin: brands page test mirroring categories; `npm test`.
- Storefront: `npm test` stays green.
- Browser verification: admin brand CRUD + product tagging; storefront menu/chips/filtering.

## Out of scope

Multi-brand products (one brand per product), brand images/logos, brand landing pages
beyond the filtered shop view, renaming the Category concept.
