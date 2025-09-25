import prisma from "../../db.server";
import { $Enums } from "@prisma/client";
import { cleanupDownloadedFile } from "../../services/workers/helpers/removeFile";

export const stopPendingTasks = async (shopId: number, jobType: $Enums.JobType) => {
  const jobTypeName = jobType === $Enums.JobType.UPDATE_VARIANTS ? 'product' : 'tracking';
  console.log(`[stopPendingTasks] Stopping pending ${jobTypeName} sync tasks for shop ${shopId}`);

  const pendingJobs = await prisma.job.findMany({
    where: {
      shopId,
      type: jobType,
      status: {
        in: [$Enums.Status.PENDING, $Enums.Status.PROCESSING, $Enums.Status.FAILED]
      }
    },
    select: { id: true }
  });


  for (const job of pendingJobs) {
    try {
      await cleanupDownloadedFile(job.id);
    } catch (error) {
    }
  }

  const result = await prisma.job.updateMany({
    where: {
      shopId,
      type: jobType,
      status: {
        in: [$Enums.Status.PENDING, $Enums.Status.PROCESSING]
      }
    },
    data: {
      status: $Enums.Status.FAILED,
      logMessage: `${jobTypeName.charAt(0).toUpperCase() + jobTypeName.slice(1)} sync job stopped by user request`,
      updatedAt: new Date()
    }
  });

  await prisma.process.updateMany({
    where: {
      shopId,
      job: {
        type: jobType
      },
      status: {
        in: [$Enums.Status.PENDING, $Enums.Status.PROCESSING]
      }
    },
    data: {
      status: $Enums.Status.FAILED,
      logMessage: `${jobTypeName.charAt(0).toUpperCase() + jobTypeName.slice(1)} sync process stopped by user request`,
      updatedAt: new Date()
    }
  });

  return Response.json({
    success: true,
    message: `Stopped ${result.count} pending ${jobTypeName} sync tasks`
  });
};
