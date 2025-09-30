import "dotenv/config.js";
import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";
import { trackNumbersLogger } from "../../../../../lib/logger";
import { downloadTrackingFileFromSftp } from "../../../../utils/sftp/downloadTrackingFile";

const downloadTrackingCsvTask = async (process: ProcessWithShop) => {
  trackNumbersLogger.info('Starting tracking CSV download from SFTP', {
    jobId: process.jobId,
    processId: process.id,
    shopDomain: process.shop.domain
  });

  const filePath = await downloadTrackingFileFromSftp();

  await prisma.job.update({
    where: {
      id: process.jobId,
      status: $Enums.Status.PENDING
    },
    data: {
      status: $Enums.Status.PROCESSING,
      logMessage: `Tracking CSV downloaded successfully: ${filePath}`,
      data: {
        filePath: filePath,
      },
      updatedAt: new Date().toISOString()
    }
  });

  const downloadProcess = await prisma.process.findFirst({
    where: {
      jobId: process.jobId,
      type: $Enums.ProcessType.DOWNLOAD_FILE,
      status: $Enums.Status.PROCESSING
    }
  });

  if (downloadProcess) {
    await prisma.process.update({
      where: { id: downloadProcess.id },
      data: {
        status: $Enums.Status.COMPLETED,
        logMessage: `Download completed successfully`,
        data: {
          filePath: filePath,
        },
        updatedAt: new Date().toISOString()
      }
    });

    await prisma.process.create({
      data: {
        jobId: process.jobId,
        shopId: process.shopId,
        type: $Enums.ProcessType.PARSE_FILE,
        status: $Enums.Status.PENDING,
        logMessage: `Parse tracking CSV process created for job ${process.jobId}`
      }
    });
  }
};

export const downloadCsv = async (process: any) => {
  await runProcessWrapper(process, downloadTrackingCsvTask);
};
