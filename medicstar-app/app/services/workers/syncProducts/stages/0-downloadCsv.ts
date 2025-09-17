import "dotenv/config.js";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";

const DOWNLOADS_FOLDER = "downloads";
const EXCEL_URL = process.env.INPUT_PRODUCT_FILE_URL as string;

const downloadCsvTask = async (process: ProcessWithShop) => {
  if (!EXCEL_URL) {
    throw new Error("INPUT_PRODUCT_FILE_URL environment variable is not set");
  }

  // Create downloads folder if it doesn't exist
  if (!fs.existsSync(DOWNLOADS_FOLDER)) {
    fs.mkdirSync(DOWNLOADS_FOLDER, { recursive: true });
  }

  // Download the file
  console.log(`[downloadCsv] Downloading file from: ${EXCEL_URL}`);
  const response = await axios.get(EXCEL_URL, { responseType: "stream" });
  const filePath = path.join(DOWNLOADS_FOLDER, `products_${Date.now()}.xlsx`);

  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  console.log(`[downloadCsv] File saved to: ${filePath}`);

  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Update job with file path and mark as PROCESSING (only if currently PENDING)
  await prisma.job.update({
    where: {
      id: process.jobId,
      status: $Enums.Status.PENDING  // Only update if job is still PENDING
    },
    data: {
      status: $Enums.Status.PROCESSING,
      logMessage: `CSV downloaded successfully: ${filePath}`,
      data: {
        filePath: filePath,
        downloadedAt: new Date().toISOString()
      }
    }
  });

  // Mark the current DOWNLOAD_FILE process as COMPLETED
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

    // Create new PARSE_FILE process
    await prisma.process.create({
      data: {
        jobId: process.jobId,
        shopId: process.shopId,
        type: $Enums.ProcessType.PARSE_FILE,
        status: $Enums.Status.PENDING,
        logMessage: `Parse CSV process created for job ${process.jobId}`
      }
    });

    console.log(`[downloadCsv] Created PARSE_FILE process for job ${process.jobId}`);
  }

  console.log(`[downloadCsv] ✅ CSV download completed for Job ID: ${process.jobId}`);
};

export const downloadCsv = async (process: any) => {
  await runProcessWrapper(process, downloadCsvTask);
};
