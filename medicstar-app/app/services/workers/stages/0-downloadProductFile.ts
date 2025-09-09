import "dotenv/config.js";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

const DOWNLOADS_FOLDER = "downloads";
const EXCEL_URL = process.env.INPUT_PRODUCT_FILE_URL as string;

export const downloadFile = async () => {
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

};

downloadFile();
