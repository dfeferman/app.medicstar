import {$Enums} from '@prisma/client';

import prisma from '../../../db.server';
import { downloadFile } from './stages/0-downloadProductFile';
import { parseProductFile } from './stages/1-parseProductFile';
import { createBulkTask } from './stages/3-run-bulk-task';
import { downloadResult } from './stages/4-downloadResult';
import { processResult } from './stages/5-processResult';
import { runTaskWrapper } from '../helpers/runTaskWrapper';

export const syncProducts = async () => {
  try {
    const inProgressTask = await prisma.syncProductsTask.findFirst({
      where: {
        inProgress: true
      }
    });

    if (inProgressTask) {
      console.log(`[index] Found in-progress task ${inProgressTask.id} at stage ${inProgressTask.stage}, skipping new task creation`);
      return;
    }

    const task = await prisma.syncProductsTask.findFirst({
      where: {
        inProgress: false,
        stage: {
          not: $Enums.StatusEnum.FINISH
        }
      }
    });

    if (task) {
      switch (task.stage) {
        case $Enums.StatusEnum.START:
          return downloadFile();
        case $Enums.StatusEnum.DOWNLOAD_FILE:
          return runTaskWrapper(task, parseProductFile);
        case $Enums.StatusEnum.CREATE_BULK_TASK:
          return runTaskWrapper(task, createBulkTask);
        case $Enums.StatusEnum.DOWNLOAD_RESULT:
          return runTaskWrapper(task, downloadResult);
        case $Enums.StatusEnum.PROCESS_RESULT:
          return runTaskWrapper(task, processResult);
      }
    }

    // TODO: Replace auto-creation with proper task management system
    // This should ideally be triggered by an API endpoint or scheduled job
    // rather than automatically creating tasks when none exist
    console.log('[index] No tasks found, auto-creating new sync task');
    return downloadFile();

    await fixZombieTasks();
  } catch (e) {
    console.warn('Error in syncProducts', e);
  }
};

const fixZombieTasks = async () => {
  await prisma.syncProductsTask.updateMany({
    where: {
      inProgress: true,
      updatedAt: {
        lte: new Date(Date.now() - 1000 * 60 * 30)
      }
    },
    data: {
      inProgress: false,
      retryCount: {
        increment: 1
      },
      error: 'zombie task'
    }
  });
};
