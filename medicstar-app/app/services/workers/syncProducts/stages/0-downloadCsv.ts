import "dotenv/config.js";
import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";
import { syncProductsLogger } from "../../../../../lib/logger";
import { downloadProductsFileFromSftp } from "../../../../utils/sftp/downloadProductsFile";

const downloadCsvTask = async (process: ProcessWithShop) => {
  syncProductsLogger.info('Starting products file download from SFTP', {
    jobId: process.jobId,
    processId: process.id,
    shopDomain: process.shop.domain
  });

  const filePath = await downloadProductsFileFromSftp();

  await prisma.job.update({
    where: {
      id: process.jobId,
      status: $Enums.Status.PENDING
    },
    data: {
      status: $Enums.Status.PROCESSING,
      logMessage: `CSV downloaded successfully: ${filePath}`,
      data: {
        filePath: filePath
      }
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
        logMessage: `Download completed successfully: ${filePath}`
      }
    });

    await prisma.process.create({
      data: {
        jobId: process.jobId,
        shopId: process.shopId,
        type: $Enums.ProcessType.PARSE_FILE,
        status: $Enums.Status.PENDING,
        logMessage: `Parse CSV process created for job ${process.jobId}`
      }
    });
  }
};

export const downloadCsv = async (process: any) => {
  await runProcessWrapper(process, downloadCsvTask);
};
