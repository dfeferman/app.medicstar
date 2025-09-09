/*
  Warnings:

  - Added the required column `optionName` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."ProductVariant" ADD COLUMN     "optionName" TEXT NOT NULL;
