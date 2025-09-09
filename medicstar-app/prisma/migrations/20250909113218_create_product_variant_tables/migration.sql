-- CreateTable
CREATE TABLE "public"."Product" (
    "id" SERIAL NOT NULL,
    "shopifyProductId" TEXT,
    "title" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "SKU" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,
    "description" TEXT,
    "priceNetto" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "deliveryTime" TEXT NOT NULL,
    "collection1" TEXT NOT NULL,
    "collection2" TEXT,
    "collection3" TEXT,
    "collection4" TEXT,
    "listOfAdvantages" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductVariant" (
    "id" SERIAL NOT NULL,
    "shopifyVariantId" TEXT,
    "title" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "SKU" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,
    "description" TEXT,
    "priceNetto" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "deliveryTime" TEXT NOT NULL,
    "collection1" TEXT,
    "collection2" TEXT,
    "collection3" TEXT,
    "collection4" TEXT,
    "listOfAdvantages" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "productId" INTEGER NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_shopifyId" ON "public"."Product"("shopifyProductId");

-- CreateIndex
CREATE INDEX "product_groupId" ON "public"."Product"("groupId");

-- CreateIndex
CREATE INDEX "product_SKU" ON "public"."Product"("SKU");

-- CreateIndex
CREATE INDEX "productVariant_shopifyId" ON "public"."ProductVariant"("shopifyVariantId");

-- CreateIndex
CREATE INDEX "productVariant_groupId" ON "public"."ProductVariant"("groupId");

-- CreateIndex
CREATE INDEX "productVariant_SKU" ON "public"."ProductVariant"("SKU");

-- AddForeignKey
ALTER TABLE "public"."ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
