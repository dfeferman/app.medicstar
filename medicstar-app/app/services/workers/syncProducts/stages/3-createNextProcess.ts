import { $Enums } from "@prisma/client";
import prisma from "../../../../db.server";

export const createNextProcess = async (process: any) => {
  console.log(`[createNextProcess] Processing Process ID: ${process.id}`);

  try {
    const processData = process.data as any;
    const batchNumber = processData.batchNumber || 1;
    const totalBatches = processData.totalBatches || 1;

    // Check if we should create UPDATE_VARIANTS or FINISH process
    if (processData.variants && processData.variants.length > 0) {
      // Create UPDATE_VARIANTS process
      await prisma.process.create({
        data: {
          jobId: process.jobId,
          type: $Enums.ProcessType.UPDATE_VARIANTS,
          status: $Enums.Status.PENDING,
          logMessage: `Variant update process for batch ${batchNumber} (${processData.variants.length} variants)`,
          data: {
            variants: processData.variants,
            batchNumber: batchNumber,
            totalBatches: totalBatches
          }
        }
      });
      console.log(`[createNextProcess] Created UPDATE_VARIANTS process for batch ${batchNumber}`);
    } else {
      // No more variants, create FINISH process
      await prisma.process.create({
        data: {
          jobId: process.jobId,
          type: $Enums.ProcessType.FINISH,
          status: $Enums.Status.PENDING,
          logMessage: `All variant updates completed, ready to finish job`
        }
      });
      console.log(`[createNextProcess] Created FINISH process for job ${process.jobId}`);
    }

    // Mark this process as completed
    await prisma.process.update({
      where: { id: process.id },
      data: {
        status: $Enums.Status.COMPLETED,
        logMessage: `Next process creation completed successfully`
      }
    });

    console.log(`[createNextProcess] ✅ Process ID: ${process.id} completed successfully`);

  } catch (error) {
    console.error(`[createNextProcess] ❌ Process ID: ${process.id} failed:`, error);
    throw error; // Re-throw to let runProcessWrapper handle it
  }
};
