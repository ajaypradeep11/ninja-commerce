-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('CAD', 'USD');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'CAD';

-- AlterTable
-- Step 1: add nullable so existing rows survive
ALTER TABLE "Product" ADD COLUMN "priceUsdCents" INTEGER;

-- Step 2: backfill from CAD at a one-time literal rate, rounded to charm pricing.
-- This literal is deliberately NOT shared with the admin autofill constant: a
-- migration must stay reproducible forever, so it cannot read a value that
-- changes later. These are a starting point for admin to review, not a commitment.
UPDATE "Product"
SET "priceUsdCents" = (FLOOR("priceCents" * 0.73 / 100) * 100) + 99
WHERE "priceUsdCents" IS NULL;

-- Step 3: lock it down
ALTER TABLE "Product" ALTER COLUMN "priceUsdCents" SET NOT NULL;
