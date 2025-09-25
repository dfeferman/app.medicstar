import { $Enums } from "@prisma/client";
import prisma from "../../../db.server";

async function runSyncNow() {
  console.log("🚀 Starting manual sync process");

  try {
    const shops = await prisma.shop.findMany({
      select: { id: true, domain: true }
    });

    if (shops.length === 0) {
      console.log("❌ No shops found in database");
      process.exit(1);
    }

    for (const shop of shops) {
      try {
        console.log(`🔄 Creating sync job for shop: ${shop.domain} (ID: ${shop.id})`);

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
      } catch (shopError) {
        console.error(`❌ Failed to create sync job for shop ${shop.domain}:`, shopError);
      }
    }
  } catch (error) {
    console.error("❌ Failed to run manual sync process:", error);
    process.exit(1);
  }
}

runSyncNow();

