import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";

type JsonObject = Record<string, unknown>;

interface UpdateResults {
  successCount: number;
  errorCount: number;
}

interface JobData extends JsonObject {
  updateResults: UpdateResults;
  validRows: number;
  totalRows: number;
}

const finishTrackingJobTask = async (process: ProcessWithShop) => {
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

  // Mark finish process as completed first
  await prisma.process.update({
    where: { id: process.id },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: `FINISH process completed for tracking job ${process.jobId}`
    }
  });

  // If any process failed, mark the job as failed
  if (failedProcesses.length > 0) {
    await prisma.job.update({
      where: { id: process.jobId },
      data: {
        status: $Enums.Status.FAILED,
        logMessage: `Tracking job failed due to ${failedProcesses.length} failed processes: ${failedProcesses.map(p => `${p.type} (${p.logMessage})`).join(', ')}`
      }
    });

    console.log(`[finishTrackingJob] ❌ Job ${process.jobId} has ${failedProcesses.length} failed processes`);
    return;
  }

  // If there are still pending or processing processes, wait for them
  if (pendingProcesses.length > 0 || processingProcesses.length > 0) {
    console.log(`[finishTrackingJob] Waiting for ${pendingProcesses.length + processingProcesses.length} processes to complete`);
    return;
  }

  // All processes completed successfully
  const job = await prisma.job.findUnique({
    where: { id: process.jobId },
    select: { data: true }
  });

  const jobData = job?.data as any;
  const totalOrders = jobData?.totalOrders || 0;
  const validRows = jobData?.validRows || 0;
  const totalRows = jobData?.totalRows || 0;

  await prisma.job.update({
    where: { id: process.jobId },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: `Tracking job completed successfully: All ${completedProcesses.length} order processes completed`,
      data: JSON.parse(JSON.stringify({
        ...jobData,
        totalRows: totalRows,
        validRows: validRows, // line items within OS orders
        totalOrders: totalOrders,
        totalOrdersProcessed: completedProcesses.filter(p => p.type === $Enums.ProcessType.UPDATE_TRACKING_NUMBERS).length,
      }))
    }
  });

  console.log(`[finishTrackingJob] ✅ Tracking job ${process.jobId} completed successfully`);
  console.log(`[finishTrackingJob] Total orders: ${totalOrders}, Valid rows: ${validRows}, Total rows: ${totalRows}`);
};

export const finish = async (process: any) => {
  await runProcessWrapper(process, finishTrackingJobTask);
};
