/*
  Warnings:

  - Added the required column `jobType` to the `Setting` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Setting" ADD COLUMN     "jobType" "public"."JobType" NOT NULL;
