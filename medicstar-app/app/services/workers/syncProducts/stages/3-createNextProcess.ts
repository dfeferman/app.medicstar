import { $Enums } from "@prisma/client";
import prisma from "../../../../db.server";

export const createNextProcess = async (process: any) => {
  console.log(`[createNextProcess] Processing Process ID: ${process.id}`);

  try {
    const processData = process.data as any;
    const batchNumber = processData.batchNumber || 1;
    const totalBatches = processData.totalBatches || 1;

    // Always create UPDATE_VARIANTS process first
    await prisma.process.create({
      data: {
        jobId: process.jobId,
        type: $Enums.ProcessType.UPDATE_VARIANTS,
        status: $Enums.Status.PENDING,
        logMessage: `Variant update process for batch ${batchNumber} (${processData.variants?.length || 0} variants)`,
        data: {
          variants: processData.variants || [],
          batchNumber: batchNumber,
          totalBatches: totalBatches
        }
      }
    });
    console.log(`[createNextProcess] Created UPDATE_VARIANTS process for batch ${batchNumber}`);

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
