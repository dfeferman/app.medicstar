import fs from "fs";
import prisma from "../../../db.server";

export const cleanupDownloadedFile = async (jobId: number) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { data: true }
    });

    if (job && job.data) {
      const jobData = job.data as any;
      const filePath = jobData.filePath;

      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      } else {
        console.warn(`[cleanupDownloadedFile] File not found or already deleted: ${filePath}`);
      }
    }
  } catch (error) {
    console.error(`[cleanupDownloadedFile] Error cleaning up file for job ${jobId}:`, error);
  }
};
