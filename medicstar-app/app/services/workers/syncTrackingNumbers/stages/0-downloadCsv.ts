import "dotenv/config.js";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";

const DOWNLOADS_FOLDER = "downloads";
const TRACKING_CSV_URL = process.env.INPUT_TRACKING_FILE_URL as string;

const downloadTrackingCsvTask = async (process: ProcessWithShop) => {
  if (!TRACKING_CSV_URL) {
    throw new Error("INPUT_TRACKING_FILE_URL environment variable is not set");
  }

  if (!fs.existsSync(DOWNLOADS_FOLDER)) {
    fs.mkdirSync(DOWNLOADS_FOLDER, { recursive: true });
  }

  const response = await axios.get(TRACKING_CSV_URL, { responseType: "stream" });
  const filePath = path.join(DOWNLOADS_FOLDER, `tracking_${Date.now()}.csv`);

  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

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
