import cron from 'node-cron';
import { $Enums } from '@prisma/client';
import prisma from '../../../db.server';

export const startTrackingCronJob = () => {
  // Schedule tracking sync every 30 minutes by default
  const cronSchedule = process.env.TRACKING_CRON_SCHEDULE || '*/30 * * * *';

  cron.schedule(cronSchedule, async () => {
    try {
      const shops = await prisma.shop.findMany({
        select: { id: true, domain: true }
      });

      if (shops.length === 0) {
        console.error('[TRACKING_CRON] No shops found in database');
        return;
      }

      for (const shop of shops) {
        try {
          // Check if there's already a pending or processing tracking job for this shop
          const existingJob = await prisma.job.findFirst({
            where: {
              shopId: shop.id,
              type: $Enums.JobType.UPDATE_TRACKING_NUMBERS,
              status: {
                in: [$Enums.Status.PENDING, $Enums.Status.PROCESSING]
              }
            }
          });

          if (existingJob) {
            console.log(`[TRACKING_CRON] Skipping shop ${shop.domain} - tracking job ${existingJob.id} already in progress`);
            continue;
          }

          const job = await prisma.job.create({
            data: {
              shopId: shop.id,
              type: $Enums.JobType.UPDATE_TRACKING_NUMBERS,
              status: $Enums.Status.PENDING,
              logMessage: `Tracking sync job created for shop ${shop.domain} at ${new Date().toISOString()}`
            }
          });

          await prisma.process.create({
            data: {
              jobId: job.id,
              shopId: shop.id,
              type: $Enums.ProcessType.DOWNLOAD_FILE,
              status: $Enums.Status.PENDING,
              logMessage: `Download tracking CSV process created for job ${job.id} in shop ${shop.domain}`
            }
          });

          console.log(`[TRACKING_CRON] Created tracking job ${job.id} for shop ${shop.domain}`);
        } catch (shopError) {
          console.error(`[TRACKING_CRON] ❌ Failed to create tracking job for shop ${shop.domain}:`, shopError);
        }
      }
      console.log(`[TRACKING_CRON] Tracking sync job creation completed for ${shops.length} shops`);
    } catch (error) {
      console.error('[TRACKING_CRON] Tracking sync job creation failed:', error);
    }
  }, {
    timezone: "UTC"
  });

  console.log(`[TRACKING_CRON] Tracking cron job scheduled with pattern: ${cronSchedule}`);
};
