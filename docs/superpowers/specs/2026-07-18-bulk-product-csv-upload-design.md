# Bulk product CSV upload (admin) — design

**Date:** 2026-07-18 · **Status:** Approved.

## Goal

Let an admin populate the catalog fast by uploading a CSV of products, with a
downloadable sample CSV to guide the format. Partial import: valid rows are
created, invalid rows are reported back with reasons.

## CSV format (also the downloadable sample)

```
name,description,price,stock,category,active
Fairy Tail Guild LED Lamp,16-color RGB lamp with remote,49.99,10,Anime Lamps,true
```
- `price` in **dollars** (admin converts to integer cents).
- `category` by **name** (must already exist; not auto-created).
- `active` optional, default `true`.
- No image column (images added later via the existing per-product upload).

## API — `POST /products/bulk` (admin-guarded)

Body: `{ items: BulkProductItem[] }` where each item is
`{ name, description?, priceCents, stockQty, categoryName, active? }`.
DTO fields are lenient (all `@IsOptional`) so the global ValidationPipe does not
reject the whole batch — **row-level validation happens in the service** so we can
report per-row errors (honoring partial import).

Service (`products.service.ts#bulkCreate`):
1. Load all categories once → case-insensitive `name → id` map.
2. For each row, validate: `name` non-empty; `priceCents` integer ≥ 0;
   `stockQty` integer ≥ 0; `categoryName` resolves; generate kebab-case `slug`
   from name (auto-suffix `-2`, `-3`… on collision within batch or DB).
3. Collect valid rows and error rows `{ row, message }`.
4. Create all valid rows in **one transaction** (`images: []`).
5. Return `{ created: number, errors: { row, message }[] }`.

Response DTO: `BulkUploadResponseDto`.

## Admin UI (`ecommerce-admin`, Products page)

- **"Bulk upload"** button → dialog.
- **"Download sample CSV"** — generated client-side (Blob), no server asset.
- File picker → parse with **PapaParse** (`header: true`) → client-side validation
  (name, numeric price, integer stock, category present + matches a fetched
  category name) → **preview table** marking valid/invalid rows with reasons.
- **"Import N valid products"** → POST valid rows (price → cents) to the bulk
  endpoint → toast with `created` count + any server-returned error rows.

## Decisions / YAGNI

- Categories must pre-exist (no auto-create). Create-only (no upsert/update).
- Duplicate slugs auto-suffixed. Client pre-validates so structural errors rarely
  reach the API; the API still validates defensively and reports per row.
- Images out of scope.

## Testing

- **API unit** (`products.service.spec` / controller): valid batch creates N;
  unknown category → error row (others still created); non-integer/negative price
  → error row; slug collision auto-suffixes; empty items rejected.
- **Admin unit**: sample CSV has expected header; parse+validate marks bad rows;
  import posts only valid rows and surfaces server errors.
- Regenerate OpenAPI clients after the new endpoint/DTO.
