import type { LoaderFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import prisma from "../db.server";
import { $Enums } from "@prisma/client";

export const settingsLoader: LoaderFunction = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const shopRecord = await prisma.shop.findUnique({
    where: { domain: shopDomain },
  });

  if (!shopRecord) {
    throw new Error(`Shop not found for domain: ${shopDomain}`);
  }

  let productUpdateSettings = await prisma.setting.findFirst({
    where: {
      shopId: shopRecord.id,
      jobType: $Enums.JobType.UPDATE_VARIANTS
    }
  });

  if (!productUpdateSettings) {
    productUpdateSettings = await prisma.setting.create({
      data: {
        shopId: shopRecord.id,
        isAutoSyncEnabled: true,
        isStopAllPendingTasks: false,
        isForceSyncEnabled: false,
        jobType: $Enums.JobType.UPDATE_VARIANTS,
      },
    });
  }

  let trackingUpdateSettings = await prisma.setting.findFirst({
    where: {
      shopId: shopRecord.id,
      jobType: $Enums.JobType.UPDATE_TRACKING_NUMBERS
    }
  });

  if (!trackingUpdateSettings) {
    trackingUpdateSettings = await prisma.setting.create({
      data: {
        shopId: shopRecord.id,
        isAutoSyncEnabled: true,
        isStopAllPendingTasks: false,
        isForceSyncEnabled: false,
        jobType: $Enums.JobType.UPDATE_TRACKING_NUMBERS,
      },
    });
  }

  return {
    productSettings: productUpdateSettings,
    trackingSettings: trackingUpdateSettings,
    cronSchedule: process.env.PRODUCT_CRON_SCHEDULE || '0 0 * * *',
    trackingCronSchedule: process.env.TRACKING_CRON_SCHEDULE || '0 0 * * *'
  };
};
