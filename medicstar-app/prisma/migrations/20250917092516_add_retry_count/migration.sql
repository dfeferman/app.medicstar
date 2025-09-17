/*
  Warnings:

  - The values [CREATE_NEXT_PROCESS] on the enum `ProcessType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."ProcessType_new" AS ENUM ('DOWNLOAD_FILE', 'PARSE_FILE', 'UPDATE_VARIANTS', 'FINISH');
ALTER TABLE "public"."Process" ALTER COLUMN "type" TYPE "public"."ProcessType_new" USING ("type"::text::"public"."ProcessType_new");
ALTER TYPE "public"."ProcessType" RENAME TO "ProcessType_old";
ALTER TYPE "public"."ProcessType_new" RENAME TO "ProcessType";
DROP TYPE "public"."ProcessType_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."Job" ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;
