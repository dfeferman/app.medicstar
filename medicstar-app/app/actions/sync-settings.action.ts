import type { ActionFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import prisma from "../db.server";
import { $Enums } from "@prisma/client";
import { toggleAutoSync } from "./setting-actions/toggleAutoSync";
import { startForceSync } from "./setting-actions/startForceSync";
import { stopPendingTasks } from "./setting-actions/stopPendingTasks";

const getShopByDomain = async (domain: string) => {
  const shop = await prisma.shop.findUnique({
    where: { domain },
  });

  if (!shop) {
    throw new Error(`Shop not found for domain: ${domain}`);
  }

  return shop;
};


export const action: ActionFunction = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const shopDomain = session.shop;
    const shop = await getShopByDomain(shopDomain);

    const formData = await request.formData();
    const actionType = formData.get("actionType") as string;
    const syncType = formData.get("syncType") as string; // "product" or "tracking"

    // Determine job type based on sync type
    const jobType = syncType === "tracking"
      ? $Enums.JobType.UPDATE_TRACKING_NUMBERS
      : $Enums.JobType.UPDATE_VARIANTS;

    switch (actionType) {
      case "toggle-auto-sync":
        const enabled = formData.get("enabled") === "true";
        return await toggleAutoSync(shop.id, enabled, jobType);

      case "force-sync":
        return await startForceSync(shop, jobType);

      case "stop-pending-tasks":
        return await stopPendingTasks(shop.id, jobType);

      default:
        return Response.json({
          success: false,
          message: "Invalid action type"
        }, { status: 400 });
    }
  } catch (error) {
    console.error(`[sync-settings.action] Error:`, error);
    return Response.json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred"
    }, { status: 500 });
  }
};
