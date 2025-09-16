import cron from 'node-cron';
import { $Enums } from '@prisma/client';
import prisma from '../../../db.server';

/**
 * Daily cron job that runs at 00:00 to create a new sync job for the shop from environment
 */
export const startDailyCronJob = () => {
  const shopDomain = process.env.SHOP_DOMAIN;

  if (!shopDomain) {
    console.error('[CRON] SHOP_DOMAIN environment variable is not set');
    return;
  }

  console.log(`[CRON] Starting cron job for shop domain: ${shopDomain}`);

  // Run every day at 00:00
  cron.schedule('0 0 * * *', async () => {
    console.log(`[CRON] Daily sync job started for shop ${shopDomain} at`, new Date().toISOString());

    try {
      // Find shop by domain
      const shop = await prisma.shop.findUnique({
        where: { domain: shopDomain },
        select: { id: true, domain: true }
      });

      if (!shop) {
        throw new Error(`Shop with domain ${shopDomain} not found in database`);
      }

      console.log(`[CRON] Creating sync job for shop: ${shop.domain} (ID: ${shop.id})`);

      // Create a new job with PENDING status
      const job = await prisma.job.create({
        data: {
          shopId: shop.id,
          status: $Enums.Status.PENDING,
          logMessage: `Daily sync job created for shop ${shop.domain} at ${new Date().toISOString()}`
        }
      });

      // Create the first process (DOWNLOAD_FILE) for the job
      await prisma.process.create({
        data: {
          jobId: job.id,
          shopId: shop.id,
          type: $Enums.ProcessType.DOWNLOAD_FILE,
          status: $Enums.Status.PENDING,
          logMessage: `Download CSV process created for job ${job.id} in shop ${shop.domain}`
        }
      });

      console.log(`[CRON] Created new sync job with ID: ${job.id} and DOWNLOAD_FILE process for shop ${shop.domain}`);
      console.log('[CRON] Daily sync job creation completed successfully');
    } catch (error) {
      console.error(`[CRON] Daily sync job creation failed for shop ${shopDomain}:`, error);
    }
  }, {
    timezone: "UTC"
  });

  console.log(`[CRON] Daily cron job scheduled to run at 00:00 UTC for shop ${shopDomain}`);
};
