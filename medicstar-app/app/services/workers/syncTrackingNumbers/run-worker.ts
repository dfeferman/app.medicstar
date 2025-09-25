import {$Enums} from '@prisma/client';
import prisma from '../../../db.server';
import { downloadCsv } from './stages/0-downloadCsv';
import { parseCsv } from './stages/1-parseCsv';
import { updateTrackingNumbers } from './stages/2-updateTrackingNumbers';
import { finish } from './stages/3-finish';
import { sleep } from '../helpers/sleep';

export const runTrackingWorker = async (): Promise<void> => {
  let pendingJob: any = null;

  try {
    pendingJob = await prisma.trackingJob.findFirst({
      where: {
        status: {
          in: [$Enums.Status.PENDING, $Enums.Status.PROCESSING]
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      include: {
        processes: true
      }
    });

    if (!pendingJob) {
      console.log('[runTrackingWorker] No pending tracking jobs found, sleeping...');
      await sleep(1000);
      return runTrackingWorker();
    }

    console.log(`[runTrackingWorker] Found pending tracking job ${pendingJob.id}`);

    const pendingProcess = await prisma.trackingProcess.findFirst({
      where: {
        jobId: pendingJob.id,
        status: $Enums.Status.PENDING
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (!pendingProcess) {
      console.log(`[runTrackingWorker] No pending processes for tracking job ${pendingJob.id}, sleeping...`);
      await sleep(1000);
      return runTrackingWorker();
    }

    console.log(`[runTrackingWorker] Processing ${pendingProcess.type} for tracking job ${pendingJob.id}`);

    try {
      switch (pendingProcess.type) {
        case $Enums.TrackingProcessType.DOWNLOAD_FILE:
          await downloadCsv(pendingProcess);
          break;
        case $Enums.TrackingProcessType.PARSE_FILE:
          await parseCsv(pendingProcess);
          break;
        case $Enums.TrackingProcessType.UPDATE_TRACKING_NUMBERS:
          await updateTrackingNumbers(pendingProcess);
          break;
        case $Enums.TrackingProcessType.FINISH:
          await finish(pendingProcess);
          break;
      }
    } catch (processError) {
      console.error(`[runTrackingWorker] Process ${pendingProcess.type} failed:`, processError);

      // Mark the job as failed when any process fails
      await prisma.trackingJob.update({
        where: { id: pendingJob.id },
        data: {
          status: $Enums.Status.FAILED,
          logMessage: `Job failed due to ${pendingProcess.type} process failure: ${processError instanceof Error ? processError.message : 'Unknown error'}`,
          updatedAt: new Date()
        }
      });

      console.log(`[runTrackingWorker] ❌ Job ${pendingJob.id} marked as FAILED due to ${pendingProcess.type} process failure`);

      await sleep(1000);
      return runTrackingWorker();
    }

    await fixZombieTrackingJobs();
    await fixZombieTrackingProcesses();
    await sleep(1000);
    return runTrackingWorker();

  } catch (error) {
    console.error('[runTrackingWorker] Error:', error);

    // If we have a pending job, mark it as failed
    if (pendingJob) {
      await prisma.trackingJob.update({
        where: { id: pendingJob.id },
        data: {
          status: $Enums.Status.FAILED,
          logMessage: `Tracking job failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
    }

    // Handle specific TrackingJob errors
    if (error instanceof Error && error.message.includes('TrackingJob')) {
      const jobId = error.message.match(/TrackingJob (\d+)/)?.[1];
      if (jobId) {
        await prisma.trackingJob.update({
          where: { id: parseInt(jobId) },
          data: {
            status: $Enums.Status.FAILED,
            logMessage: `Tracking job failed: ${error.message}`
          }
        });
      }
    }

    await sleep(1000);
    return runTrackingWorker();
  }
};

const fixZombieTrackingJobs = async () => {
  const result = await prisma.trackingJob.updateMany({
    where: {
      status: $Enums.Status.PROCESSING,
      updatedAt: {
        lte: new Date(Date.now() - 1000 * 60 * 30)
      }
    },
    data: {
      status: $Enums.Status.FAILED,
      retryCount: { increment: 1 },
      logMessage: 'Tracking job marked as failed due to timeout (zombie job)',
      updatedAt: new Date()
    }
  });

  if (result.count > 0) {
    console.log(`[fixZombieTrackingJobs] Fixed ${result.count} zombie tracking jobs`);
  }
};

const fixZombieTrackingProcesses = async () => {
  const result = await prisma.trackingProcess.updateMany({
    where: {
      status: $Enums.Status.PROCESSING,
      updatedAt: {
        lte: new Date(Date.now() - 1000 * 60 * 30)
      }
    },
    data: {
      status: $Enums.Status.FAILED,
      retryCount: { increment: 1 },
      logMessage: 'Tracking process marked as failed due to timeout (zombie process)',
      updatedAt: new Date()
    }
  });

  if (result.count > 0) {
    console.log(`[fixZombieTrackingProcesses] Fixed ${result.count} zombie tracking processes`);
  }
};

runTrackingWorker();
