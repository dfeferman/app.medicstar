import prisma from "../../db.server";
import { $Enums } from "@prisma/client";

export const toggleAutoSync = async (shopId: number, enabled: boolean, jobType: $Enums.JobType) => {
  const jobTypeName = jobType === $Enums.JobType.UPDATE_VARIANTS ? 'Product' : 'Tracking';
  console.log(`[toggleAutoSync] Setting ${jobTypeName.toLowerCase()} sync to ${enabled} for shop ${shopId}`);

  // Find existing settings for this shop and job type
  const existingSettings = await prisma.setting.findFirst({
    where: {
      shopId,
      jobType
    }
  });

  if (existingSettings) {
    // Update existing settings
    await prisma.setting.update({
      where: { id: existingSettings.id },
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
        isForceSyncEnabled: false,
        jobType
      }
    });
  }

  return Response.json({
    success: true,
    message: `${jobTypeName} sync ${enabled ? 'enabled' : 'disabled'} successfully`
  });
};
