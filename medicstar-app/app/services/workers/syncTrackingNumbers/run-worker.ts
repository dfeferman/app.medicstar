import {$Enums} from '@prisma/client';
import prisma from '../../../db.server';
import { downloadCsv } from './stages/0-downloadCsv';
import { parseCsv } from './stages/1-parseCsv';
import { updateTrackingNumbers } from './stages/2-updateTrackingNumbers';
import { finish } from './stages/3-finish';
import { sleep } from '../helpers/sleep';
import { trackNumbersLogger } from '../../../../lib/logger';

export const runTrackingWorker = async (): Promise<void> => {
  let pendingJob: any = null;

  try {
    pendingJob = await prisma.job.findFirst({
      where: {
        status: {
          in: [$Enums.Status.PENDING, $Enums.Status.PROCESSING]
        },
        type: $Enums.JobType.UPDATE_TRACKING_NUMBERS
      },
      orderBy: {
        createdAt: 'asc'
      },
      include: {
        processes: true
      }
    });

    if (!pendingJob) {
      // trackNumbersLogger.info('No pending tracking jobs found, sleeping...');
      await sleep(1000);
      return runTrackingWorker();
    }

    trackNumbersLogger.info('Found pending tracking job', { jobId: pendingJob.id });

    const pendingProcess = await prisma.process.findFirst({
      where: {
        jobId: pendingJob.id,
        status: $Enums.Status.PENDING
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (!pendingProcess) {
      // trackNumbersLogger.info('No pending processes for tracking job, sleeping...', { jobId: pendingJob.id });
      await sleep(1000);
      return runTrackingWorker();
    }

    trackNumbersLogger.info('Processing tracking process for job', {
      jobId: pendingJob.id,
      processType: pendingProcess.type,
      processId: pendingProcess.id
    });

    try {
      switch (pendingProcess.type) {
        case $Enums.ProcessType.DOWNLOAD_FILE:
          await downloadCsv(pendingProcess);
          break;
        case $Enums.ProcessType.PARSE_FILE:
          await parseCsv(pendingProcess);
          break;
        case $Enums.ProcessType.UPDATE_TRACKING_NUMBERS:
          await updateTrackingNumbers(pendingProcess);
          break;
        case $Enums.ProcessType.FINISH:
          await finish(pendingProcess);
          break;
      }
    } catch (processError) {
      trackNumbersLogger.error('Process failed', {
        processType: pendingProcess.type,
        jobId: pendingJob.id,
        processId: pendingProcess.id,
        error: processError instanceof Error ? processError.message : 'Unknown error',
        stack: processError instanceof Error ? processError.stack : undefined
      });

      // Mark the job as failed when any process fails
      await prisma.job.update({
        where: { id: pendingJob.id },
        data: {
          status: $Enums.Status.FAILED,
          logMessage: `Job failed due to ${pendingProcess.type} process failure: ${processError instanceof Error ? processError.message : 'Unknown error'}`,
          updatedAt: new Date()
        }
      });

      trackNumbersLogger.error('Job marked as FAILED due to process failure', {
        jobId: pendingJob.id,
        processType: pendingProcess.type
      });

      await sleep(1000);
      return runTrackingWorker();
    }

    await fixZombieTrackingJobs();
    await fixZombieTrackingProcesses();
    await sleep(1000);
    return runTrackingWorker();

  } catch (error) {
    trackNumbersLogger.error('Tracking worker error occurred', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      pendingJobId: pendingJob?.id
    });

    // If we have a pending job, mark it as failed
    if (pendingJob) {
      await prisma.job.update({
        where: { id: pendingJob.id },
        data: {
          status: $Enums.Status.FAILED,
          logMessage: `Tracking job failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
      trackNumbersLogger.error('Pending job marked as failed', { jobId: pendingJob.id });
    }

    // Handle specific Job errors
    if (error instanceof Error && error.message.includes('Job')) {
      const jobId = error.message.match(/Job (\d+)/)?.[1];
      if (jobId) {
        await prisma.job.update({
          where: { id: parseInt(jobId) },
          data: {
            status: $Enums.Status.FAILED,
            logMessage: `Tracking job failed: ${error.message}`
          }
        });
        trackNumbersLogger.error('Job marked as failed due to error', { jobId: parseInt(jobId), error: error.message });
      }
    }

    await sleep(1000);
    return runTrackingWorker();
  }
};

const fixZombieTrackingJobs = async () => {
  const result = await prisma.job.updateMany({
    where: {
      status: $Enums.Status.PROCESSING,
      type: $Enums.JobType.UPDATE_TRACKING_NUMBERS,
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
    trackNumbersLogger.warn('Fixed zombie tracking jobs', { count: result.count });
  }
};

const fixZombieTrackingProcesses = async () => {
  const result = await prisma.process.updateMany({
    where: {
      status: $Enums.Status.PROCESSING,
      type: $Enums.ProcessType.UPDATE_TRACKING_NUMBERS,
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
    trackNumbersLogger.warn('Fixed zombie tracking processes', { count: result.count });
  }
};

runTrackingWorker();
