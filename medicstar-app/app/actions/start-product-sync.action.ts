import type { ActionFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import prisma from "../db.server";
import { $Enums } from "@prisma/client";

// Helper function to get shop by domain
const getShopByDomain = async (domain: string) => {
  const shop = await prisma.shop.findUnique({
    where: { domain },
  });

  if (!shop) {
    throw new Error(`Shop not found for domain: ${domain}`);
  }

  return shop;
};

// Toggle auto sync settings
const toggleAutoSync = async (shopId: number, enabled: boolean) => {
  console.log(`[toggleAutoSync] Setting auto sync to ${enabled} for shop ${shopId}`);

  // Check if settings exist first
  const existingSettings = await prisma.setting.findUnique({
    where: { shopId }
  });

  if (existingSettings) {
    // Update existing settings
    await prisma.setting.update({
      where: { shopId },
      data: {
        isAutoSyncEnabled: enabled,
        updatedAt: new Date()
      }
    });
  } else {
    // Create new settings
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

// Start force sync
const startForceSync = async (shop: { id: number; domain: string }) => {
  console.log(`[startForceSync] Starting force sync for shop ${shop.domain}`);

  // Create a new job for force sync
  const job = await prisma.job.create({
    data: {
      shopId: shop.id,
      status: $Enums.Status.PENDING,
      logMessage: `Manual sync job created for shop ${shop.domain}`
    }
  });

  // Update the job with the actual job ID
  await prisma.job.update({
    where: { id: job.id },
    data: {
      logMessage: `Manual sync job created for shop ${shop.domain} for Job ID: ${job.id}`
    }
  });

  // Create the first process (DOWNLOAD_FILE) for the job
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
    message: `Force sync started successfully. Job created for Job ID: ${job.id}`
  });
};

// Stop all pending tasks
const stopPendingTasks = async (shopId: number) => {
  console.log(`[stopPendingTasks] Stopping pending tasks for shop ${shopId}`);

  // Update all pending/processing jobs to failed
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

  // Also update all pending/processing processes
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
    message: `Stopped ${result.count} pending tasks successfully`
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
