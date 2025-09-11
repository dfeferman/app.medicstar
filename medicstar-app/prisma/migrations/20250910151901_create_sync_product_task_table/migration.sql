-- CreateEnum
CREATE TYPE "public"."StatusEnum" AS ENUM ('CREATE_BULK_TASK', 'WAIT_FOR_FINISH', 'DOWNLOAD_RESULT', 'PROCESS_RESULT', 'FINISH');

-- CreateTable
CREATE TABLE "public"."StatusFlag" (
    "id" SERIAL NOT NULL,
    "shouldSuspiciousBeUpdated" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncProductsTask" (
    "id" SERIAL NOT NULL,
    "stage" "public"."StatusEnum" NOT NULL,
    "inProgress" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB NOT NULL DEFAULT '{}',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncProductsTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncProductsTaskStageIndex" ON "public"."SyncProductsTask"("stage");

-- CreateIndex
CREATE INDEX "SyncProductsTaskInProgressUpdatedAtIndex" ON "public"."SyncProductsTask"("inProgress", "updatedAt");
