import cron from 'node-cron';
import { $Enums } from '@prisma/client';
import prisma from '../../../db.server';

/**
 * Daily cron job that runs at 00:00 to create sync jobs for all shops in the database
 */
export const startDailyCronJob = () => {
  console.log('[CRON] Starting cron job');

  // Run every day at 00:00
  cron.schedule('0 0 * * *', async () => {
    console.log(`[CRON] Daily sync job started for all shops at`, new Date().toISOString());

    try {
      // Get all shops from database
      const shops = await prisma.shop.findMany({
        select: { id: true, domain: true }
      });

      if (shops.length === 0) {
        console.log('[CRON] No shops found in database');
        return;
      }

      console.log(`[CRON] Found ${shops.length} shops, creating sync jobs...`);

      // Create sync jobs for all shops
      for (const shop of shops) {
        try {
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

          console.log(`[CRON] ✅ Created sync job with ID: ${job.id} for shop ${shop.domain}`);
        } catch (shopError) {
          console.error(`[CRON] ❌ Failed to create sync job for shop ${shop.domain}:`, shopError);
          // Continue with other shops even if one fails
        }
      }

      console.log(`[CRON] Daily sync job creation completed for ${shops.length} shops`);
    } catch (error) {
      console.error('[CRON] Daily sync job creation failed:', error);
    }
  }, {
    timezone: "UTC"
  });

  console.log('[CRON] Daily cron job scheduled to run at 00:00 UTC for all shops');
};
