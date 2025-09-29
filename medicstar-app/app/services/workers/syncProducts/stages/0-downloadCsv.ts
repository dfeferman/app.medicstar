import "dotenv/config.js";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";
import { syncProductsLogger } from "../../../../../lib/logger";

const DOWNLOADS_FOLDER = "downloads";
const EXCEL_URL = process.env.INPUT_PRODUCT_FILE_URL as string;

const downloadCsvTask = async (process: ProcessWithShop) => {
  syncProductsLogger.info('Starting CSV download', {
    jobId: process.jobId,
    processId: process.id,
    shopDomain: process.shop.domain
  });

  if (!EXCEL_URL) {
    throw new Error("INPUT_PRODUCT_FILE_URL environment variable is not set");
  }

  if (!fs.existsSync(DOWNLOADS_FOLDER)) {
    fs.mkdirSync(DOWNLOADS_FOLDER, { recursive: true });
  }

  const response = await axios.get(EXCEL_URL, { responseType: "stream" });
  const filePath = path.join(DOWNLOADS_FOLDER, `products_${Date.now()}.xlsx`);

  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });


  if (response.status !== 200) {
    syncProductsLogger.error('Failed to download CSV file', {
      jobId: process.jobId,
      processId: process.id,
      status: response.status,
      statusText: response.statusText
    });
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  syncProductsLogger.info('CSV file downloaded successfully', {
    jobId: process.jobId,
    processId: process.id,
    filePath,
    fileSize: response.headers['content-length']
  });

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
