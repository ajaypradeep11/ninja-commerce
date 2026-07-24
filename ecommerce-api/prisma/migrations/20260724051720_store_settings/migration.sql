-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "freeShippingThresholdCents" INTEGER NOT NULL DEFAULT 6500,
    "standardShippingCents" INTEGER NOT NULL DEFAULT 999,
    "expeditedShippingCents" INTEGER NOT NULL DEFAULT 1499,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);
