/*
  Warnings:

  - You are about to drop the `TrackingJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TrackingProcess` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `type` to the `Job` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."JobType" AS ENUM ('UPDATE_VARIANTS', 'UPDATE_TRACKING_NUMBERS');

-- AlterEnum
ALTER TYPE "public"."ProcessType" ADD VALUE 'UPDATE_TRACKING_NUMBERS';

-- DropForeignKey
ALTER TABLE "public"."TrackingJob" DROP CONSTRAINT "TrackingJob_shopId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TrackingProcess" DROP CONSTRAINT "TrackingProcess_jobId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TrackingProcess" DROP CONSTRAINT "TrackingProcess_shopId_fkey";

-- AlterTable
ALTER TABLE "public"."Job" ADD COLUMN     "type" "public"."JobType" NOT NULL;

-- DropTable
DROP TABLE "public"."TrackingJob";

-- DropTable
DROP TABLE "public"."TrackingProcess";

-- DropEnum
DROP TYPE "public"."TrackingProcessType";
