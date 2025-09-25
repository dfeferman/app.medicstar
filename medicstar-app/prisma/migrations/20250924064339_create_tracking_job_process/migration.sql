-- CreateEnum
CREATE TYPE "public"."TrackingProcessType" AS ENUM ('DOWNLOAD_FILE', 'PARSE_FILE', 'UPDATE_TRACKING_NUMBERS', 'FINISH');

-- CreateTable
CREATE TABLE "public"."TrackingJob" (
    "id" SERIAL NOT NULL,
    "status" "public"."Status" NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "logMessage" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shopId" INTEGER NOT NULL,

    CONSTRAINT "TrackingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrackingProcess" (
    "id" SERIAL NOT NULL,
    "status" "public"."Status" NOT NULL,
    "type" "public"."TrackingProcessType" NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "logMessage" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "jobId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shopId" INTEGER NOT NULL,

    CONSTRAINT "TrackingProcess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackingJobStatusIndex" ON "public"."TrackingJob"("status");

-- CreateIndex
CREATE INDEX "TrackingJobCreatedAtIndex" ON "public"."TrackingJob"("createdAt");

-- CreateIndex
CREATE INDEX "TrackingProcessStatusIndex" ON "public"."TrackingProcess"("status");

-- CreateIndex
CREATE INDEX "TrackingProcessCreatedAtIndex" ON "public"."TrackingProcess"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."TrackingJob" ADD CONSTRAINT "TrackingJob_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrackingProcess" ADD CONSTRAINT "TrackingProcess_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."TrackingJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrackingProcess" ADD CONSTRAINT "TrackingProcess_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
