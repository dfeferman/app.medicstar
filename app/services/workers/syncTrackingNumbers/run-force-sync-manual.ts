import { $Enums } from '@prisma/client';
import prisma from '../../../db.server';
import { trackNumbersLogger } from '../../../../lib/logger';

const FORCE_TRACKING_SYNC = async () => {
  try {
    trackNumbersLogger.info('Starting manual tracking sync');

    const shops = await prisma.shop.findMany({
      select: { id: true, domain: true }
    });

    if (shops.length === 0) {
      trackNumbersLogger.error('No shops found in database');
      return;
    }

    for (const shop of shops) {
      try {
        trackNumbersLogger.info('Creating tracking job for shop', {
          shopDomain: shop.domain,
          shopId: shop.id
        });

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

        trackNumbersLogger.info('Successfully created tracking job and process', {
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

    trackNumbersLogger.info('Manual tracking sync job creation completed', { shopCount: shops.length });
  } catch (error) {
    trackNumbersLogger.error('Manual tracking sync failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
};

FORCE_TRACKING_SYNC();
