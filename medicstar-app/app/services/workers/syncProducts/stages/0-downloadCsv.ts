import "dotenv/config.js";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";

const DOWNLOADS_FOLDER = "downloads";
const EXCEL_URL = process.env.INPUT_PRODUCT_FILE_URL as string;

export const downloadCsv = async (job: any) => {
  console.log(`[downloadCsv] Starting CSV download for Job ID: ${job.id}`);

  if (!EXCEL_URL) {
    throw new Error("INPUT_PRODUCT_FILE_URL environment variable is not set");
  }

  // Mark job as processing if it was pending
  if (job.status === $Enums.Status.PENDING) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: $Enums.Status.PROCESSING,
        logMessage: `Job started processing at ${new Date().toISOString()}`
      }
    });
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

  // Update job with file path
  await prisma.job.update({
    where: { id: job.id },
    data: {
      logMessage: `CSV downloaded successfully: ${filePath}`,
      data: {
        filePath: filePath,
        downloadedAt: new Date().toISOString()
      }
    }
  });

  // Update the existing DOWNLOAD_FILE process to PARSE_FILE
  const downloadProcess = await prisma.process.findFirst({
    where: {
      jobId: job.id,
      type: $Enums.ProcessType.DOWNLOAD_FILE
    }
  });

  if (downloadProcess) {
    await prisma.process.update({
      where: { id: downloadProcess.id },
      data: {
        type: $Enums.ProcessType.PARSE_FILE,
        logMessage: `Download completed, ready for parsing`
      }
    });
  }

  console.log(`[downloadCsv] ✅ CSV download completed for Job ID: ${job.id}`);
};
