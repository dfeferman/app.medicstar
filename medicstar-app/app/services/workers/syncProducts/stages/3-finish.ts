import { $Enums } from "@prisma/client";
import prisma from "../../../../db.server";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";
import { cleanupDownloadedFile } from "../../helpers/removeFile";
import { syncProductsLogger } from "../../../../../lib/logger";

const finishTask = async (process: ProcessWithShop) => {
  syncProductsLogger.info('Starting job finish process', {
    jobId: process.jobId,
    processId: process.id,
    shopDomain: process.shop.domain
  });

  const allProcesses = await prisma.process.findMany({
    where: { jobId: process.jobId },
    select: {
      id: true,
      type: true,
      status: true,
      logMessage: true
    }
  });

  const completedProcesses = allProcesses.filter(p => p.status === $Enums.Status.COMPLETED);
  const failedProcesses = allProcesses.filter(p => p.status === $Enums.Status.FAILED);
  const pendingProcesses = allProcesses.filter(p => p.status === $Enums.Status.PENDING);
  const processingProcesses = allProcesses.filter(p => p.status === $Enums.Status.PROCESSING && p.id !== process.id);

  await prisma.process.update({
    where: { id: process.id },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: `FINISH process completed for job ${process.jobId}`
    }
  });

  if (failedProcesses.length > 0) {
    syncProductsLogger.error('Job failed due to failed processes', {
      jobId: process.jobId,
      processId: process.id,
      failedProcessCount: failedProcesses.length,
      failedProcesses: failedProcesses.map(p => ({ id: p.id, type: p.type, logMessage: p.logMessage }))
    });

    await prisma.job.update({
      where: { id: process.jobId },
      data: {
        status: $Enums.Status.FAILED,
        logMessage: `Job failed due to ${failedProcesses.length} failed processes`
      }
    });

    await cleanupDownloadedFile(process.jobId);
    return;
  }

  if (pendingProcesses.length > 0 || processingProcesses.length > 0) {
    return;
  }

  syncProductsLogger.info('Job completed successfully', {
    jobId: process.jobId,
    processId: process.id,
    totalProcesses: completedProcesses.length + 1,
    completedProcesses: completedProcesses.length,
    failedProcesses: failedProcesses.length
  });

  await prisma.job.update({
    where: { id: process.jobId },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: `Job completed successfully: All ${completedProcesses.length + 1} processes completed`
    }
  });

  await cleanupDownloadedFile(process.jobId);
};

export const finish = async (process: any) => {
  await runProcessWrapper(process, finishTask);
};
