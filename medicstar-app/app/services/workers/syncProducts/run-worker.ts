import {$Enums} from '@prisma/client';
import prisma from '../../../db.server';
import { downloadCsv } from './stages/0-downloadCsv';
import { parseCsv } from './stages/1-parseCsv';
import { processVariantBatch } from './stages/2-updateVariants';
import { finish } from './stages/3-finish';
import { sleep } from '../helpers/sleep';
import { syncProductsLogger } from '../../../../lib/logger';

export const runWorker = async (): Promise<void> => {
  try {
    const pendingJob = await prisma.job.findFirst({
      where: {
        status: {
          in: [$Enums.Status.PENDING, $Enums.Status.PROCESSING]
        },
        type: $Enums.JobType.UPDATE_VARIANTS
      },
      orderBy: {
        createdAt: 'asc'
      },
      include: {
        processes: true
      }
    });

    if (!pendingJob) {
      syncProductsLogger.info('No pending jobs found, sleeping...');
      await sleep(1000);
      return runWorker();
    }

    syncProductsLogger.info('Found pending job', { jobId: pendingJob.id });

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
      syncProductsLogger.info('No pending processes for job, sleeping...', { jobId: pendingJob.id });
      await sleep(1000);
      return runWorker();
    }

    syncProductsLogger.info('Processing process for job', {
      jobId: pendingJob.id,
      processType: pendingProcess.type,
      processId: pendingProcess.id
    });

    switch (pendingProcess.type) {
      case $Enums.ProcessType.DOWNLOAD_FILE:
        await downloadCsv(pendingProcess);
        break;
      case $Enums.ProcessType.PARSE_FILE:
        await parseCsv(pendingProcess);
        break;
      case $Enums.ProcessType.UPDATE_VARIANTS:
        await processVariantBatch(pendingProcess);
        break;
      case $Enums.ProcessType.FINISH:
        await finish(pendingProcess);
        break;
    }

    await fixZombieJobs();
    await fixZombieProcesses();
    await sleep(1000);
    return runWorker();

  } catch (error) {
    syncProductsLogger.error('Worker error occurred', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    if (error instanceof Error && error.message.includes('Job')) {
      const jobId = error.message.match(/Job (\d+)/)?.[1];
      if (jobId) {
        await prisma.job.update({
          where: { id: parseInt(jobId) },
          data: {
            status: $Enums.Status.FAILED,
            logMessage: `Job failed: ${error.message}`
          }
        });
        syncProductsLogger.error('Job marked as failed', { jobId: parseInt(jobId), error: error.message });
      }
    }

    await sleep(1000);
    return runWorker();
  }
};

const fixZombieJobs = async () => {
  const result = await prisma.job.updateMany({
    where: {
      status: $Enums.Status.PROCESSING,
      type: $Enums.JobType.UPDATE_VARIANTS,
      updatedAt: {
        lte: new Date(Date.now() - 1000 * 60 * 30)
      }
    },
    data: {
      status: $Enums.Status.FAILED,
      retryCount: { increment: 1 },
      logMessage: 'Job marked as failed due to timeout (zombie job)',
      updatedAt: new Date()
    }
  });

  if (result.count > 0) {
    syncProductsLogger.warn('Fixed zombie variant jobs', { count: result.count });
  }
};

const fixZombieProcesses = async () => {
  const result = await prisma.process.updateMany({
    where: {
      status: $Enums.Status.PROCESSING,
      type: {
        in: [$Enums.ProcessType.DOWNLOAD_FILE, $Enums.ProcessType.PARSE_FILE, $Enums.ProcessType.UPDATE_VARIANTS, $Enums.ProcessType.FINISH]
      },
      updatedAt: {
        lte: new Date(Date.now() - 1000 * 60 * 30)
      }
    },
    data: {
      status: $Enums.Status.FAILED,
      retryCount: { increment: 1 },
      logMessage: 'Process marked as failed due to timeout (zombie process)',
      updatedAt: new Date()
    }
  });

  if (result.count > 0) {
    syncProductsLogger.warn('Fixed zombie variant processes', { count: result.count });
  }
};

runWorker();
