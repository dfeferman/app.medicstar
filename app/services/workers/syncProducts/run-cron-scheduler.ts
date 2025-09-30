import cron from 'node-cron';
import { $Enums } from '@prisma/client';
import prisma from '../../../db.server';
import { syncProductsLogger } from '../../../../lib/logger';

export const startDailyCronJob = () => {
  const cronSchedule = process.env.CRON_SCHEDULE || '0 0 * * *';

  cron.schedule(cronSchedule, async () => {
    try {
      const shops = await prisma.shop.findMany({
        select: { id: true, domain: true }
      });

      if (shops.length === 0) {
        syncProductsLogger.error('No shops found in database for cron job');
        return;
      }

      for (const shop of shops) {
        try {
          const job = await prisma.job.create({
            data: {
              shopId: shop.id,
              type: $Enums.JobType.UPDATE_VARIANTS,
              status: $Enums.Status.PENDING,
              logMessage: `Daily sync job created for shop ${shop.domain} at ${new Date().toISOString()}`
            }
          });

          await prisma.process.create({
            data: {
              jobId: job.id,
              shopId: shop.id,
              type: $Enums.ProcessType.DOWNLOAD_FILE,
              status: $Enums.Status.PENDING,
              logMessage: `Download CSV process created for job ${job.id} in shop ${shop.domain}`
            }
          });
        } catch (shopError) {
          syncProductsLogger.error('Failed to create sync job for shop', {
            shopDomain: shop.domain,
            shopId: shop.id,
            error: shopError instanceof Error ? shopError.message : 'Unknown error',
            stack: shopError instanceof Error ? shopError.stack : undefined
          });
        }
      }
      syncProductsLogger.info('Daily sync job creation completed', { shopCount: shops.length });
    } catch (error) {
      syncProductsLogger.error('Daily sync job creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }, {
    timezone: "UTC"
  });
};
