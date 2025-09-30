import cron from 'node-cron';
import { $Enums } from '@prisma/client';
import prisma from '../../../db.server';
import { trackNumbersLogger } from '../../../../lib/logger';

export const startTrackingCronJob = () => {
  // Schedule tracking sync every 30 minutes by default
  const cronSchedule = process.env.TRACKING_CRON_SCHEDULE || '*/30 * * * *';

  cron.schedule(cronSchedule, async () => {
    try {
      const shops = await prisma.shop.findMany({
        select: { id: true, domain: true }
      });

      if (shops.length === 0) {
        trackNumbersLogger.error('No shops found in database for tracking cron job');
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
            trackNumbersLogger.info('Skipping shop - tracking job already in progress', {
              shopDomain: shop.domain,
              shopId: shop.id,
              existingJobId: existingJob.id
            });
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

          trackNumbersLogger.info('Created tracking job for shop', {
            jobId: job.id,
            shopDomain: shop.domain,
            shopId: shop.id
          });
        } catch (shopError) {
          trackNumbersLogger.error('Failed to create tracking job for shop', {
            shopDomain: shop.domain,
            shopId: shop.id,
            error: shopError instanceof Error ? shopError.message : 'Unknown error',
            stack: shopError instanceof Error ? shopError.stack : undefined
          });
        }
      }
      trackNumbersLogger.info('Tracking sync job creation completed', { shopCount: shops.length });
    } catch (error) {
      trackNumbersLogger.error('Tracking sync job creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }, {
    timezone: "UTC"
  });

  trackNumbersLogger.info('Tracking cron job scheduled', { cronSchedule });
};
