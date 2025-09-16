import cron from 'node-cron';
import { $Enums } from '@prisma/client';
import prisma from '../../../db.server';

/**
 * Daily cron job that runs at 00:00 to create a new sync job
 */
export const startDailyCronJob = () => {
  // Run every day at 00:00
  cron.schedule('* * * * *', async () => {
    console.log('[CRON] Daily sync job started at', new Date().toISOString());

    try {
      // Create a new job with PENDING status
      const job = await prisma.job.create({
        data: {
          status: $Enums.Status.PENDING,
          logMessage: `Daily sync job created at ${new Date().toISOString()}`
        }
      });

      // Create the first process (DOWNLOAD_FILE) for the job
      await prisma.process.create({
        data: {
          jobId: job.id,
          type: $Enums.ProcessType.DOWNLOAD_FILE,
          status: $Enums.Status.PENDING,
          logMessage: `Download CSV process created for job ${job.id}`
        }
      });

      console.log(`[CRON] Created new sync job with ID: ${job.id} and DOWNLOAD_FILE process`);
      console.log('[CRON] Daily sync job creation completed successfully');
    } catch (error) {
      console.error('[CRON] Daily sync job creation failed:', error);
    }
  }, {
    timezone: "UTC"
  });

  console.log('[CRON] Daily cron job scheduled to run at 00:00 UTC');
};
