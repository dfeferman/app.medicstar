import { $Enums } from "@prisma/client";
import prisma from "../../../../db.server";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";
import { cleanupDownloadedFile } from "../../helpers/removeFile";

const finishTask = async (process: ProcessWithShop) => {
  console.log(`[finishTask] Checking job completion for job ${process.jobId}`);

  // Get all processes for this job
  const allProcesses = await prisma.process.findMany({
    where: { jobId: process.jobId },
    select: {
      id: true,
      type: true,
      status: true,
      logMessage: true
    }
  });

  console.log(`[finishTask] Found ${allProcesses.length} processes for job ${process.jobId}`);

  // Check if all processes are COMPLETED (excluding the current FINISH process)
  const completedProcesses = allProcesses.filter(p => p.status === $Enums.Status.COMPLETED);
  const failedProcesses = allProcesses.filter(p => p.status === $Enums.Status.FAILED);
  const pendingProcesses = allProcesses.filter(p => p.status === $Enums.Status.PENDING);
  const processingProcesses = allProcesses.filter(p => p.status === $Enums.Status.PROCESSING && p.id !== process.id);

  console.log(`[finishTask] Process status summary:`);
  console.log(`  - COMPLETED: ${completedProcesses.length}`);
  console.log(`  - FAILED: ${failedProcesses.length}`);
  console.log(`  - PENDING: ${pendingProcesses.length}`);
  console.log(`  - PROCESSING: ${processingProcesses.length}`);

  // First, mark the current FINISH process as COMPLETED
  await prisma.process.update({
    where: { id: process.id },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: `FINISH process completed for job ${process.jobId}`
    }
  });

  // If any process failed, mark job as FAILED
  if (failedProcesses.length > 0) {
    console.log(`[finishTask] Job ${process.jobId} has failed processes, marking job as FAILED`);

    await prisma.job.update({
      where: { id: process.jobId },
      data: {
        status: $Enums.Status.FAILED,
        logMessage: `Job failed due to ${failedProcesses.length} failed processes`
      }
    });

    // Clean up downloaded files
    await cleanupDownloadedFile(process.jobId);

    console.log(`[finishTask] ❌ Job ${process.jobId} marked as FAILED`);
    return;
  }

  // If there are still PENDING or PROCESSING processes, wait
  if (pendingProcesses.length > 0 || processingProcesses.length > 0) {
    console.log(`[finishTask] Job ${process.jobId} still has pending/processing processes, waiting...`);
    console.log(`[finishTask] ⏳ Job ${process.jobId} still has pending processes`);
    return;
  }

  // All processes are COMPLETED, mark job as COMPLETED
  console.log(`[finishTask] All processes completed for job ${process.jobId}, marking job as COMPLETED`);

  await prisma.job.update({
    where: { id: process.jobId },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: `Job completed successfully: All ${completedProcesses.length + 1} processes completed`
    }
  });

  // Clean up downloaded files
  await cleanupDownloadedFile(process.jobId);

  console.log(`[finishTask] ✅ Job ${process.jobId} marked as COMPLETED`);
};

export const finish = async (process: any) => {
  await runProcessWrapper(process, finishTask);
};
