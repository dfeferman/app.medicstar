import type { LoaderFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import prisma from "../db.server";
import { $Enums } from "@prisma/client";

export const settingsLoader: LoaderFunction = async ({ request }) => {
  try {
    console.log('[settingsLoader] Starting loader...');

    const { session } = await authenticate.admin(request);
    console.log('[settingsLoader] Authenticated successfully, shop:', session.shop);

    const shopDomain = session.shop;

    const shopRecord = await prisma.shop.findUnique({
      where: { domain: shopDomain },
    });

    if (!shopRecord) {
      console.error(`[settingsLoader] Shop not found for domain: ${shopDomain}`);
      throw new Error(`Shop not found for domain: ${shopDomain}`);
    }

    console.log(`[settingsLoader] Found shop record: ${shopRecord.id}`);

    // Find or create settings for UPDATE_VARIANTS job type specifically
    let productUpdateSettings = await prisma.setting.findFirst({
      where: {
        shopId: shopRecord.id,
        jobType: $Enums.JobType.UPDATE_VARIANTS
      }
    });

    if (!productUpdateSettings) {
      console.log('[settingsLoader] Creating product settings...');
      productUpdateSettings = await prisma.setting.create({
        data: {
          shopId: shopRecord.id,
          isAutoSyncEnabled: true,
          isStopAllPendingTasks: false,
          isForceSyncEnabled: false,
          jobType: $Enums.JobType.UPDATE_VARIANTS,
        },
      });
      console.log('[settingsLoader] Product settings created:', productUpdateSettings.id);
    } else {
      console.log('[settingsLoader] Found existing product settings:', productUpdateSettings.id);
    }

    let trackingUpdateSettings = await prisma.setting.findFirst({
      where: {
        shopId: shopRecord.id,
        jobType: $Enums.JobType.UPDATE_TRACKING_NUMBERS
      }
    });

    if (!trackingUpdateSettings) {
      console.log('[settingsLoader] Creating tracking settings...');
      trackingUpdateSettings = await prisma.setting.create({
        data: {
          shopId: shopRecord.id,
          isAutoSyncEnabled: true,
          isStopAllPendingTasks: false,
          isForceSyncEnabled: false,
          jobType: $Enums.JobType.UPDATE_TRACKING_NUMBERS,
        },
      });
      console.log('[settingsLoader] Tracking settings created:', trackingUpdateSettings.id);
    } else {
      console.log('[settingsLoader] Found existing tracking settings:', trackingUpdateSettings.id);
    }

    console.log('[settingsLoader] Returning settings data...');
    return {
      productSettings: productUpdateSettings,
      trackingSettings: trackingUpdateSettings,
      cronSchedule: process.env.CRON_SCHEDULE || '0 0 * * *',
      trackingCronSchedule: process.env.TRACKING_CRON_SCHEDULE || '0 0 * * *'
    };
  } catch (error) {
    console.error('[settingsLoader] Error:', error);
    throw error;
  }
};
