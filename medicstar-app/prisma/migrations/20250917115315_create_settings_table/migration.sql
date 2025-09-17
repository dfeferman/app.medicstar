-- CreateTable
CREATE TABLE "public"."Setting" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "isAutoSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isStopAllPendingTasks" BOOLEAN NOT NULL DEFAULT false,
    "isForceSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setting_shopId_key" ON "public"."Setting"("shopId");

-- CreateIndex
CREATE INDEX "SettingShopIdIndex" ON "public"."Setting"("shopId");

-- CreateIndex
CREATE INDEX "SettingIsAutoSyncEnabledIndex" ON "public"."Setting"("isAutoSyncEnabled");

-- CreateIndex
CREATE INDEX "SettingIsStopAllPendingTasksIndex" ON "public"."Setting"("isStopAllPendingTasks");

-- CreateIndex
CREATE INDEX "SettingIsForceSyncEnabledIndex" ON "public"."Setting"("isForceSyncEnabled");

-- AddForeignKey
ALTER TABLE "public"."Setting" ADD CONSTRAINT "Setting_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
