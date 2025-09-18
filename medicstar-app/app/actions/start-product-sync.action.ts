import type { ActionFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import prisma from "../db.server";
import { $Enums } from "@prisma/client";
import { cleanupDownloadedFile } from "../services/workers/helpers/removeFile";

const getShopByDomain = async (domain: string) => {
  const shop = await prisma.shop.findUnique({
    where: { domain },
  });

  if (!shop) {
    throw new Error(`Shop not found for domain: ${domain}`);
  }

  return shop;
};

const toggleAutoSync = async (shopId: number, enabled: boolean) => {
  console.log(`[toggleAutoSync] Setting auto sync to ${enabled} for shop ${shopId}`);

  const existingSettings = await prisma.setting.findUnique({
    where: { shopId }
  });

  if (existingSettings) {
    await prisma.setting.update({
      where: { shopId },
      data: {
        isAutoSyncEnabled: enabled,
        updatedAt: new Date()
      }
    });
  } else {
    await prisma.setting.create({
      data: {
        shopId,
        isAutoSyncEnabled: enabled,
        isStopAllPendingTasks: false,
        isForceSyncEnabled: false
      }
    });
  }

  return Response.json({
    success: true,
    message: `Auto sync ${enabled ? 'enabled' : 'disabled'} successfully`
  });
};

const startForceSync = async (shop: { id: number; domain: string }) => {
  console.log(`[startForceSync] Starting force sync for shop ${shop.domain}`);

  const job = await prisma.job.create({
    data: {
      shopId: shop.id,
      status: $Enums.Status.PENDING,
      logMessage: `Manual sync job created for shop ${shop.domain}`
    }
  });

  await prisma.job.update({
    where: { id: job.id },
    data: {
      logMessage: `Manual sync job created for shop ${shop.domain} for Task ID: ${job.id}`
    }
  });

  await prisma.process.create({
    data: {
      jobId: job.id,
      shopId: shop.id,
      type: $Enums.ProcessType.DOWNLOAD_FILE,
      status: $Enums.Status.PENDING,
      logMessage: `Download CSV process created for job ${job.id} in shop ${shop.domain}`
    }
  });

  return Response.json({
    success: true,
    message: `Force sync started successfully. Task created for Task ID: ${job.id}`
  });
};

const stopPendingTasks = async (shopId: number) => {
  console.log(`[stopPendingTasks] Stopping pending tasks for shop ${shopId}`);

  const pendingJobs = await prisma.job.findMany({
    where: {
      shopId,
      status: {
        in: [$Enums.Status.PENDING, $Enums.Status.PROCESSING, $Enums.Status.FAILED]
      }
    },
    select: { id: true }
  });

  console.log(`[stopPendingTasks] Found ${pendingJobs.length} pending jobs to stop`);

  for (const job of pendingJobs) {
    try {
      await cleanupDownloadedFile(job.id);
      console.log(`[stopPendingTasks] Cleaned up file for job ${job.id}`);
    } catch (error) {
      console.error(`[stopPendingTasks] Error cleaning up file for job ${job.id}:`, error);
    }
  }

  const result = await prisma.job.updateMany({
    where: {
      shopId,
      status: {
        in: [$Enums.Status.PENDING, $Enums.Status.PROCESSING]
      }
    },
    data: {
      status: $Enums.Status.FAILED,
      logMessage: "Job stopped by user request",
      updatedAt: new Date()
    }
  });

  await prisma.process.updateMany({
    where: {
      shopId,
      status: {
        in: [$Enums.Status.PENDING, $Enums.Status.PROCESSING]
      }
    },
    data: {
      status: $Enums.Status.FAILED,
      logMessage: "Process stopped by user request",
      updatedAt: new Date()
    }
  });

  return Response.json({
    success: true,
    message: `Stopped ${result.count} pending tasks`
  });
};

export const action: ActionFunction = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const shopDomain = session.shop;
    const shop = await getShopByDomain(shopDomain);

    const formData = await request.formData();
    const actionType = formData.get("actionType") as string;

    switch (actionType) {
      case "toggle-auto-sync":
        return await toggleAutoSync(shop.id, formData.get("enabled") === "true");

      case "force-sync":
        return await startForceSync(shop);

      case "stop-pending-tasks":
        return await stopPendingTasks(shop.id);

      default:
        return Response.json({
          success: false,
          message: "Invalid action type"
        }, { status: 400 });
    }
  } catch (error) {
    console.error(`[start-product-sync.action] Error:`, error);
    return Response.json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred"
    }, { status: 500 });
  }
};
