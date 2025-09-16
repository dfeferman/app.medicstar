import type { Process } from "@prisma/client";
import { $Enums } from "@prisma/client";
import prisma from "../../../db.server";

export async function runProcessWrapper(
  process: Process,
  taskRunner: (process: Process) => Promise<void>,
) {
  // Mark process as processing
  await prisma.process.update({
    where: { id: process.id },
    data: {
      status: $Enums.Status.PROCESSING,
      updatedAt: new Date(),
    },
  });

  try {
    await taskRunner(process);
  } catch (error) {
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

