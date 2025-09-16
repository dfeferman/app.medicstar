-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."Job" (
    "id" SERIAL NOT NULL,
    "status" "public"."Status" NOT NULL,
    "logMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Process" (
    "id" SERIAL NOT NULL,
    "status" "public"."Status" NOT NULL,
    "logMessage" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "jobId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobStatusIndex" ON "public"."Job"("status");

-- CreateIndex
CREATE INDEX "JobCreatedAtIndex" ON "public"."Job"("createdAt");

-- CreateIndex
CREATE INDEX "ProcessStatusIndex" ON "public"."Process"("status");

-- CreateIndex
CREATE INDEX "ProcessCreatedAtIndex" ON "public"."Process"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."Process" ADD CONSTRAINT "Process_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
