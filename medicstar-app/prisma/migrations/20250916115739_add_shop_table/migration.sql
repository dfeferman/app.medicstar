/*
  Warnings:

  - Added the required column `shopId` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopId` to the `Process` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Job" ADD COLUMN     "shopId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."Process" ADD COLUMN     "shopId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "public"."Shop" (
    "id" SERIAL NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_domain_key" ON "public"."Shop"("domain");

-- AddForeignKey
ALTER TABLE "public"."Job" ADD CONSTRAINT "Job_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Process" ADD CONSTRAINT "Process_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
