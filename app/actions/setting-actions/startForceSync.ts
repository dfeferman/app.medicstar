import prisma from "../../db.server";
import { $Enums } from "@prisma/client";
import { json } from "@remix-run/node";

export const startForceSync = async (shop: { id: number; domain: string }, jobType: $Enums.JobType) => {
  const jobTypeName = jobType === $Enums.JobType.UPDATE_VARIANTS ? 'product' : 'tracking';

  const job = await prisma.job.create({
    data: {
      shopId: shop.id,
      status: $Enums.Status.PENDING,
      logMessage: `Manual ${jobTypeName} sync job created for shop ${shop.domain}`,
      type: jobType
    }
  });

  await prisma.job.update({
    where: { id: job.id },
    data: {
      logMessage: `Manual ${jobTypeName} sync job created for shop ${shop.domain} for Task ID: ${job.id}`
    }
  });

  await prisma.process.create({
    data: {
      jobId: job.id,
      shopId: shop.id,
      type: $Enums.ProcessType.DOWNLOAD_FILE,
      status: $Enums.Status.PENDING,
      logMessage: `Download CSV process created for ${jobTypeName} job ${job.id} in shop ${shop.domain}`
    }
  });

  return json({
    success: true,
    message: `Force ${jobTypeName} sync started successfully. Task created for Task ID: ${job.id}`
  });
};
