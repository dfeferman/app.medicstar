import cron from 'node-cron';
import { $Enums } from '@prisma/client';
import prisma from '../../../db.server';

export const startDailyCronJob = () => {
  const cronSchedule = process.env.CRON_SCHEDULE || '0 0 * * *';

  cron.schedule(cronSchedule, async () => {
    try {
      const shops = await prisma.shop.findMany({
        select: { id: true, domain: true }
      });

      if (shops.length === 0) {
        console.error('[CRON] No shops found in database');
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
          console.error(`[CRON] ❌ Failed to create sync job for shop ${shop.domain}:`, shopError);
        }
      }
      console.log(`[CRON] Daily sync job creation completed for ${shops.length} shops`);
    } catch (error) {
      console.error('[CRON] Daily sync job creation failed:', error);
    }
  }, {
    timezone: "UTC"
  });
};
