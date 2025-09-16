import { $Enums } from "@prisma/client";
import prisma from "./app/db.server";

async function runSyncNow() {
  console.log("🚀 Starting sync process...");

  const job = await prisma.job.create({
        data: {
          status: $Enums.Status.PENDING,
          logMessage: `Daily sync job created at ${new Date().toISOString()}`
        }
      });

    await prisma.process.create({
        data: {
          jobId: job.id,
          type: $Enums.ProcessType.DOWNLOAD_FILE,
          status: $Enums.Status.PENDING,
          logMessage: `Download CSV process created for job ${job.id}`
        }
      });

}

runSyncNow();

