/*
  Warnings:

  - Added the required column `type` to the `Process` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."ProcessType" AS ENUM ('DOWNLOAD_FILE', 'PARSE_FILE', 'UPDATE_VARIANTS', 'FINISH');

-- AlterTable
ALTER TABLE "public"."Process" ADD COLUMN     "type" "public"."ProcessType" NOT NULL;
