/*
  Warnings:

  - You are about to drop the column `collection1` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `collection2` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `collection3` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `collection4` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryTime` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `metaDescription` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `metaTitle` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `vendor` on the `ProductVariant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."ProductVariant" DROP COLUMN "collection1",
DROP COLUMN "collection2",
DROP COLUMN "collection3",
DROP COLUMN "collection4",
DROP COLUMN "deliveryTime",
DROP COLUMN "description",
DROP COLUMN "metaDescription",
DROP COLUMN "metaTitle",
DROP COLUMN "vendor";
