import { $Enums } from "@prisma/client";
import prisma from "../../../db.server";

async function runSyncNow() {
  console.log("🚀 Starting manual sync process");

  try {
    // Get all shops from database
    const shops = await prisma.shop.findMany({
      select: { id: true, domain: true }
    });

    if (shops.length === 0) {
      console.log("❌ No shops found in database");
      process.exit(1);
    }

    console.log(`📊 Found ${shops.length} shops, creating sync jobs...`);

    let successCount = 0;
    let errorCount = 0;

    // Create sync jobs for all shops
    for (const shop of shops) {
      try {
        console.log(`🔄 Creating sync job for shop: ${shop.domain} (ID: ${shop.id})`);

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
        successCount++;
      } catch (shopError) {
        console.error(`❌ Failed to create sync job for shop ${shop.domain}:`, shopError);
        errorCount++;
        // Continue with other shops even if one fails
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`✅ Successfully created sync jobs for ${successCount} shops`);
    console.log(`❌ Failed to create sync jobs for ${errorCount} shops`);
    console.log(`📊 Total shops processed: ${shops.length}`);

    if (errorCount > 0) {
      console.log(`⚠️  Some shops failed, but the process completed`);
    } else {
      console.log(`🎉 All shops processed successfully!`);
    }

  } catch (error) {
    console.error("❌ Failed to run manual sync process:", error);
    process.exit(1);
  }
}

runSyncNow();

