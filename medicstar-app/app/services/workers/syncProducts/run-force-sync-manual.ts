import { $Enums } from "@prisma/client";
import prisma from "../../../db.server";
import { syncProductsLogger } from "../../../../lib/logger";

async function runSyncNow() {
  syncProductsLogger.info("Starting manual sync process");

  try {
    const shops = await prisma.shop.findMany({
      select: { id: true, domain: true }
    });

    if (shops.length === 0) {
      syncProductsLogger.error("No shops found in database");
      process.exit(1);
    }

    for (const shop of shops) {
      try {
        syncProductsLogger.info("Creating sync job for shop", {
          shopDomain: shop.domain,
          shopId: shop.id
        });

        const job = await prisma.job.create({
          data: {
            shopId: shop.id,
            type: $Enums.JobType.UPDATE_VARIANTS,
            status: $Enums.Status.PENDING,
            logMessage: `Manual sync job created for shop ${shop.domain} at ${new Date().toISOString()}`
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

        syncProductsLogger.info("Successfully created sync job and process", {
          jobId: job.id,
          shopDomain: shop.domain,
          shopId: shop.id
        });
      } catch (shopError) {
        syncProductsLogger.error("Failed to create sync job for shop", {
          shopDomain: shop.domain,
          shopId: shop.id,
          error: shopError instanceof Error ? shopError.message : 'Unknown error',
          stack: shopError instanceof Error ? shopError.stack : undefined
        });
      }
    }
  } catch (error) {
    syncProductsLogger.error("Failed to run manual sync process", {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

runSyncNow();

