import { $Enums } from "@prisma/client";
import prisma from "../../../db.server";

async function runSyncNow() {
  const shopDomain = process.env.SHOP_DOMAIN;

  if (!shopDomain) {
    console.error("❌ SHOP_DOMAIN environment variable is not set");
    process.exit(1);
  }

  console.log(`🚀 Starting sync process for shop ${shopDomain}...`);

  try {
    // Find shop by domain
    const shop = await prisma.shop.findUnique({
      where: { domain: shopDomain },
      select: { id: true, domain: true }
    });

    if (!shop) {
      throw new Error(`Shop with domain ${shopDomain} not found in database`);
    }

    console.log(`Creating sync job for shop: ${shop.domain} (ID: ${shop.id})`);

    const job = await prisma.job.create({
      data: {
        shopId: shop.id,
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

    console.log(`✅ Created sync job with ID: ${job.id} for shop ${shop.domain}`);
  } catch (error) {
    console.error(`❌ Failed to create sync job for shop ${shopDomain}:`, error);
    process.exit(1);
  }
}

runSyncNow();

