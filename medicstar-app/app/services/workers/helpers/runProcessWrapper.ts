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
  console.log(`[runProcessWrapper] Processing Process ID: ${process.id}`);

  // Mark process as processing
  await prisma.process.update({
    where: { id: process.id },
    data: {
      status: $Enums.Status.PROCESSING,
      updatedAt: new Date(),
    },
  });

  try {
    // Get shop information from process
    const shop = await prisma.shop.findUnique({
      where: { id: process.shopId },
      select: { id: true, domain: true }
    });

    if (!shop) {
      throw new Error(`Shop not found for process ID: ${process.id}`);
    }

    console.log(`[runProcessWrapper] Using shop domain: ${shop.domain} (ID: ${shop.id})`);

    // Create process with shop information
    const processWithShop: ProcessWithShop = {
      ...process,
      shop: shop
    };

    await taskRunner(processWithShop);
  } catch (error) {
    console.error(`[runProcessWrapper] Process ID: ${process.id} failed:`, error);

    await prisma.process.update({
      where: { id: process.id },
      data: {
        status: $Enums.Status.FAILED,
        updatedAt: new Date(),
        logMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error; // Re-throw to let the calling function handle it
  }
}

