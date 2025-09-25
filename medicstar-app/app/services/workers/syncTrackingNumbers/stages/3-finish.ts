import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";
import { runProcessTrackingWrapper, TrackingProcessWithShop } from "../../helpers/runProcessTrackingWrapper";

type JsonObject = Record<string, unknown>;

interface UpdateResults {
  successCount: number;
  errorCount: number;
}

interface JobData extends JsonObject {
  filePath: string;
  updateResults: UpdateResults;
}

const finishTrackingJobTask = async (process: TrackingProcessWithShop) => {
  const job = await prisma.trackingJob.findUnique({
    where: { id: process.jobId },
    include: {
      processes: true
    }
  });

  if (!job) {
    throw new Error(`TrackingJob ${process.jobId} not found`);
  }

  // Check if all processes are completed (excluding the current finish process)
  const incompleteProcesses = job.processes.filter(
    p => p.id !== process.id && p.status !== $Enums.Status.COMPLETED && p.status !== $Enums.Status.FAILED
  );

  if (incompleteProcesses.length > 0) {
    console.log(`[finishTrackingJob] Waiting for ${incompleteProcesses.length} processes to complete`);
    return;
  }

  // Check if any process failed
  const failedProcesses = job.processes.filter(p => p.status === $Enums.Status.FAILED);
  const hasFailures = failedProcesses.length > 0;

  // If any process failed, mark the job as failed
  if (hasFailures) {
    console.log(`[finishTrackingJob] ❌ Job ${process.jobId} has ${failedProcesses.length} failed processes:`,
      failedProcesses.map(p => `${p.type} (${p.logMessage})`)
    );
  }

  // Calculate summary statistics
  const data = job.data as JobData;
  const summary = {
    totalRows: data?.validRows || 0,
    orderCount: data?.orderCount || 0,
    successCount: data?.updateResults?.successCount || 0,
    errorCount: data?.updateResults?.errorCount || 0,
    failedProcesses: failedProcesses.length,
    completedAt: new Date().toISOString()
  };

  // Update job status
  const finalStatus = hasFailures ? $Enums.Status.FAILED : $Enums.Status.COMPLETED;
  const logMessage = hasFailures
    ? `Tracking job completed with ${failedProcesses.length} failed processes`
    : `Tracking job completed successfully: ${summary.successCount} orders updated, ${summary.errorCount} errors`;

  await prisma.trackingJob.update({
    where: { id: process.jobId },
    data: {
      status: finalStatus,
      logMessage,
      data: JSON.parse(JSON.stringify({
        ...data,
        summary,
        finalStatus,
        completedAt: summary.completedAt
      }))
    }
  });

  // Mark finish process as completed
  await prisma.trackingProcess.update({
    where: { id: process.id },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: `Tracking job finished with status: ${finalStatus}`
    }
  });

  console.log(`[finishTrackingJob] ✅ Tracking job ${process.jobId} completed with status: ${finalStatus}`);
  console.log(`[finishTrackingJob] Summary:`, summary);
};

export const finish = async (process: any) => {
  await runProcessTrackingWrapper(process, finishTrackingJobTask);
};
