import { $Enums } from '@prisma/client';
import prisma from '../../../db.server';

const FORCE_TRACKING_SYNC = async () => {
  try {
    console.log('[FORCE_TRACKING_SYNC] Starting manual tracking sync...');

    const shops = await prisma.shop.findMany({
      select: { id: true, domain: true }
    });

    if (shops.length === 0) {
      console.error('[FORCE_TRACKING_SYNC] No shops found in database');
      return;
    }

    for (const shop of shops) {
      try {
        console.log(`[FORCE_TRACKING_SYNC] Creating tracking job for shop ${shop.domain}`);

        const job = await prisma.job.create({
          data: {
            shopId: shop.id,
            type: $Enums.JobType.UPDATE_TRACKING_NUMBERS,
            status: $Enums.Status.PENDING,
            logMessage: `Manual tracking sync job created for shop ${shop.domain} at ${new Date().toISOString()}`
          }
        });

        await prisma.process.create({
          data: {
            jobId: job.id,
            shopId: shop.id,
            type: $Enums.ProcessType.DOWNLOAD_FILE,
            status: $Enums.Status.PENDING,
            logMessage: `Manual download tracking CSV process created for job ${job.id} in shop ${shop.domain}`
          }
        });

        console.log(`[FORCE_TRACKING_SYNC] ✅ Created tracking job ${job.id} for shop ${shop.domain}`);
      } catch (shopError) {
        console.error(`[FORCE_TRACKING_SYNC] ❌ Failed to create tracking job for shop ${shop.domain}:`, shopError);
      }
    }

    console.log(`[FORCE_TRACKING_SYNC] Manual tracking sync job creation completed for ${shops.length} shops`);
  } catch (error) {
    console.error('[FORCE_TRACKING_SYNC] Manual tracking sync failed:', error);
  }
};

FORCE_TRACKING_SYNC();
