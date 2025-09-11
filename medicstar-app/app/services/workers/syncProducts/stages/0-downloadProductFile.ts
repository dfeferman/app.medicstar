import "dotenv/config.js";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";

const DOWNLOADS_FOLDER = "downloads";
const EXCEL_URL = process.env.INPUT_PRODUCT_FILE_URL as string;

export const downloadFile = async () => {
    // Find or create SyncProductsTask record
    const task = await prisma.syncProductsTask.upsert({
      where: { id: 1 }, // Assuming we use a single task record
      update: {
        stage: $Enums.StatusEnum.START,
        inProgress: true,
        data: { downloadStartedAt: new Date().toISOString() },
        error: null,
      },
      create: {
        stage: $Enums.StatusEnum.START,
        inProgress: true,
        data: { downloadStartedAt: new Date().toISOString() },
      },
    });

    console.log(`[stage-0] Created/updated SyncProductsTask: ${task.id}`);

    if (!fs.existsSync(DOWNLOADS_FOLDER)) {
      fs.mkdirSync(DOWNLOADS_FOLDER, { recursive: true });
    }

    console.log(`[stage-0] Downloading file from: ${EXCEL_URL}`);
    const response = await axios.get(EXCEL_URL, { responseType: "stream" });
    const filePath = path.join(DOWNLOADS_FOLDER, `products_${Date.now()}.xlsx`);

    await new Promise<void>((resolve, reject) => {
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    console.log(`[stage-0] File saved to: ${filePath}`);

    // Update SyncProductsTask on successful download
    if (response.status === 200) {
      await prisma.syncProductsTask.update({
        where: { id: task.id },
        data: {
          stage: $Enums.StatusEnum.DOWNLOAD_FILE,
          inProgress: false,
          data: {
            ...task.data as any,
            downloadCompletedAt: new Date().toISOString(),
            downloadedFilePath: filePath,
            downloadStatus: "success",
          },
          error: null,
        },
      });
      console.log(`[stage-0] ✅ File download completed successfully. Updated SyncProductsTask.`);
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
};
