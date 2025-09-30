import type { Process } from "@prisma/client";
import { $Enums } from "@prisma/client";
import prisma from "../../../db.server";

export interface ProcessWithShop extends Process {
  shop: {
    id: number;
    domain: string;
  };
}

export async function runProcessWrapper(
  process: Process,
  taskRunner: (process: ProcessWithShop) => Promise<void>,
) {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: process.shopId },
      select: { id: true, domain: true }
    });

    if (!shop) {
      throw new Error(`Shop not found for process ID: ${process.id}`);
    }

    await prisma.process.update({
      where: { id: process.id },
      data: {
        status: $Enums.Status.PROCESSING,
        retryCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    await prisma.job.update({
      where: { id: process.jobId },
      data: {
        retryCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    const processWithShop: ProcessWithShop = {
      ...process,
      shop: shop
    };

    await taskRunner(processWithShop);
  } catch (error) {
    await prisma.process.update({
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

