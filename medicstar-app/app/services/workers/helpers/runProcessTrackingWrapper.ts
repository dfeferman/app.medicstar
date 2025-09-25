import type { TrackingProcess } from "@prisma/client";
import { $Enums } from "@prisma/client";
import prisma from "../../../db.server";

export interface TrackingProcessWithShop extends TrackingProcess {
  shop: {
    id: number;
    domain: string;
  };
}

export async function runProcessTrackingWrapper(
  process: TrackingProcess,
  taskRunner: (process: TrackingProcessWithShop) => Promise<void>,
) {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: process.shopId },
      select: { id: true, domain: true }
    });

    if (!shop) {
      throw new Error(`Shop not found for tracking process ID: ${process.id}`);
    }

    await prisma.trackingProcess.update({
      where: { id: process.id },
      data: {
        status: $Enums.Status.PROCESSING,
        retryCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    await prisma.trackingJob.update({
      where: { id: process.jobId },
      data: {
        retryCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    const processWithShop: TrackingProcessWithShop = {
      ...process,
      shop: shop
    };

    await taskRunner(processWithShop);
  } catch (error) {
    await prisma.trackingProcess.update({
      where: { id: process.id },
      data: {
        status: $Enums.Status.FAILED,
        updatedAt: new Date(),
        logMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}
