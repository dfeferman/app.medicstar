-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."ProcessType" AS ENUM ('DOWNLOAD_FILE', 'PARSE_FILE', 'UPDATE_VARIANTS', 'UPDATE_TRACKING_NUMBERS', 'FINISH');

-- CreateEnum
CREATE TYPE "public"."JobType" AS ENUM ('UPDATE_VARIANTS', 'UPDATE_TRACKING_NUMBERS');

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Shop" (
    "id" SERIAL NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Job" (
    "id" SERIAL NOT NULL,
    "status" "public"."Status" NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "logMessage" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "type" "public"."JobType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shopId" INTEGER NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Process" (
    "id" SERIAL NOT NULL,
    "status" "public"."Status" NOT NULL,
    "type" "public"."ProcessType" NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "logMessage" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "jobId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shopId" INTEGER NOT NULL,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Setting" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "isAutoSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isStopAllPendingTasks" BOOLEAN NOT NULL DEFAULT false,
    "isForceSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "jobType" "public"."JobType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_domain_key" ON "public"."Shop"("domain");

-- CreateIndex
CREATE INDEX "JobStatusIndex" ON "public"."Job"("status");

-- CreateIndex
CREATE INDEX "JobCreatedAtIndex" ON "public"."Job"("createdAt");

-- CreateIndex
CREATE INDEX "ProcessStatusIndex" ON "public"."Process"("status");

-- CreateIndex
CREATE INDEX "ProcessCreatedAtIndex" ON "public"."Process"("createdAt");

-- CreateIndex
CREATE INDEX "SettingShopIdIndex" ON "public"."Setting"("shopId");

-- CreateIndex
CREATE INDEX "SettingIsAutoSyncEnabledIndex" ON "public"."Setting"("isAutoSyncEnabled");

-- CreateIndex
CREATE INDEX "SettingIsStopAllPendingTasksIndex" ON "public"."Setting"("isStopAllPendingTasks");

-- CreateIndex
CREATE INDEX "SettingIsForceSyncEnabledIndex" ON "public"."Setting"("isForceSyncEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_shopId_jobType_key" ON "public"."Setting"("shopId", "jobType");

-- AddForeignKey
ALTER TABLE "public"."Job" ADD CONSTRAINT "Job_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Process" ADD CONSTRAINT "Process_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Process" ADD CONSTRAINT "Process_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Setting" ADD CONSTRAINT "Setting_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
