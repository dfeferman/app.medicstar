/*
  Warnings:

  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductVariant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StatusFlag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SyncProductsTask` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ProductVariant" DROP CONSTRAINT "ProductVariant_productId_fkey";

-- DropTable
DROP TABLE "public"."Product";

-- DropTable
DROP TABLE "public"."ProductVariant";

-- DropTable
DROP TABLE "public"."StatusFlag";

-- DropTable
DROP TABLE "public"."SyncProductsTask";

-- DropEnum
DROP TYPE "public"."StatusEnum";
