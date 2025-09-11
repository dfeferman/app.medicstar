import type { SyncProductsTask } from "@prisma/client";
import prisma from "../../../db.server";

export async function runTaskWrapper(
  task: SyncProductsTask,
  taskRunner: (task: SyncProductsTask) => Promise<void>,
) {
  // Mark task as in progress
  await prisma.syncProductsTask.update({
    where: { id: task.id },
    data: {
      retryCount: { increment: 1 },
      inProgress: true,
      updatedAt: new Date(),
    },
  });

  try {
    await taskRunner(task);
  } catch (error) {
    await prisma.syncProductsTask.update({
      where: { id: task.id },
      data: {
        retryCount: { increment: 1 },
        inProgress: false,
        updatedAt: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error; // Re-throw to let the calling function handle it
  }
}
