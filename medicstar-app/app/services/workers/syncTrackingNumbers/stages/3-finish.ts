import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";

interface TrackingJobData {
  filePath: string;
  ordersFoundInCsv: number;
  validLineItemsCount: number;
  totalCsvRows: number;
  totalOrdersProcessed?: number;
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

  await prisma.process.update({
    where: { id: process.id },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: `FINISH process completed for tracking job ${process.jobId}`
    }
  });

  if (failedProcesses.length > 0) {
    await prisma.job.update({
      where: { id: process.jobId },
      data: {
        status: $Enums.Status.FAILED,
        logMessage: `Tracking job failed due to ${failedProcesses.length} failed processes: ${failedProcesses.map(p => `${p.type} (${p.logMessage})`).join(', ')}`
      }
    });
    return;
  }

  if (pendingProcesses.length > 0 || processingProcesses.length > 0) {
    return;
  }

  const job = await prisma.job.findUnique({
    where: { id: process.jobId },
    select: { data: true }
  });

  const jobData = job?.data as unknown as TrackingJobData;
  const completedOrderProcesses = completedProcesses.filter(p => p.type === $Enums.ProcessType.UPDATE_TRACKING_NUMBERS);

  await prisma.job.update({
    where: { id: process.jobId },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: `Tracking job completed successfully: All ${completedProcesses.length} order processes completed`,
      data: JSON.parse(JSON.stringify({
        ...jobData,
        totalOrdersProcessed: completedOrderProcesses.length,
      }))
    }
  });
};

export const finish = async (process: any) => {
  await runProcessWrapper(process, finishTrackingJobTask);
};
