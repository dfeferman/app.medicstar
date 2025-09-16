// import { $Enums } from "@prisma/client";
// import prisma from "../../../../db.server";

// export const finish = async (job: any) => {
//   console.log(`[finish] Checking completion status for Job ID: ${job.id}`);

//   // Get all processes for this job
//   const allProcesses = await prisma.process.findMany({
//     where: { jobId: job.id }
//   });

//   const completedCount = allProcesses.filter(p => p.status === $Enums.Status.COMPLETED).length;
//   const failedCount = allProcesses.filter(p => p.status === $Enums.Status.FAILED).length;
//   const pendingCount = allProcesses.filter(p => p.status === $Enums.Status.PENDING).length;
//   const processingCount = allProcesses.filter(p => p.status === $Enums.Status.PROCESSING).length;

//   console.log(`[finish] Job ${job.id} status: ${completedCount} completed, ${failedCount} failed, ${pendingCount} pending, ${processingCount} processing`);

//   if (failedCount > 0) {
//     // Job failed if any process failed
//     await prisma.job.update({
//       where: { id: job.id },
//       data: {
//         status: $Enums.Status.FAILED,
//         logMessage: `Job failed: ${failedCount} processes failed, ${completedCount} completed`
//       }
//     });
//     console.log(`[finish] ❌ Job ${job.id} marked as FAILED`);
//   } else if (completedCount > 0 && (pendingCount === 0 || (pendingCount === 1 && allProcesses.some(p => p.type === $Enums.ProcessType.FINISH && p.status === $Enums.Status.PENDING)))) {
//     // All processes completed successfully (only FINISH process might be pending)

//     // Mark the FINISH process as completed first
//     const finishProcess = allProcesses.find(p => p.type === $Enums.ProcessType.FINISH && p.status === $Enums.Status.PENDING);
//     if (finishProcess) {
//       await prisma.process.update({
//         where: { id: finishProcess.id },
//         data: {
//           status: $Enums.Status.COMPLETED
//           // Keep original logMessage and data
//         }
//       });
//     }

//     // Now mark the job as completed
//     await prisma.job.update({
//       where: { id: job.id },
//       data: {
//         status: $Enums.Status.COMPLETED,
//         logMessage: `Job completed successfully: ${completedCount + (finishProcess ? 1 : 0)} processes completed`
//       }
//     });

//     console.log(`[finish] ✅ Job ${job.id} marked as COMPLETED`);
//   } else {
//     // Still processing
//     console.log(`[finish] Job ${job.id} still processing, waiting for completion`);
//   }
// };
