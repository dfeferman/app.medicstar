import * as path from "path";
import * as fs from "fs";
import * as process from "process";
import XLSX from "xlsx";
import { $Enums } from "@prisma/client";
import type { Process } from '@prisma/client'
import prisma from "../../../../db.server";
import { buildLowerKeyMap, findFirstMatchingHeader, convertToStringOrEmpty, convertToIntegerOrZero } from "../../../../utils/xlsx";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";
import { syncProductsLogger } from "../../../../../lib/logger";

type CsvRowData = Record<string, unknown>;
type JsonObject = Record<string, unknown>;

interface JobData extends JsonObject {
  filePath: string;
  totalVariants?: number;
  totalBatches?: number;
}
interface VariantData {
  sku: string;
  price: string;
  quantity: string;
}

const BATCH_SIZE = 250;
const headerAliases: Record<string, string[]> = {
  sku: ["produktnummer"],
  quantity: ["lagerbestand"],
  price: ["ek netto"],
};

const parseCsvTask = async (processData: ProcessWithShop) => {
  syncProductsLogger.info('Starting CSV parsing', {
    jobId: processData.jobId,
    processId: processData.id,
    shopDomain: processData.shop.domain
  });

  const job = await prisma.job.findUnique({
    where: { id: processData.jobId },
    select: { data: true }
  });

  if (!job) {
    throw new Error(`Job ${processData.jobId} not found`);
  }

  const jobData = job.data as JobData;
  const filePath = jobData?.filePath;

  if (!filePath) {
    throw new Error("No file path found in job data");
  }

  const absoluteFilePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absoluteFilePath)) {
    throw new Error(`File does not exist: ${absoluteFilePath}`);
  }

  const workbook = XLSX.readFile(absoluteFilePath);
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<CsvRowData>(sheet, { defval: null });

  const variants: VariantData[] = [];

  for (const row of rows) {
    const caseInsensitiveRow = buildLowerKeyMap(row);

    const sku = convertToStringOrEmpty(findFirstMatchingHeader(caseInsensitiveRow, headerAliases.sku));
    const quantity = convertToIntegerOrZero(findFirstMatchingHeader(caseInsensitiveRow, headerAliases.quantity));
    const price = convertToStringOrEmpty(findFirstMatchingHeader(caseInsensitiveRow, headerAliases.price));

    if (sku && sku.trim() !== "") {
      variants.push({
        sku: sku.trim(),
        price: price,
        quantity: quantity.toString(),
      });
    }
  }

  if (variants.length === 0) {
    syncProductsLogger.warn('No variants found in CSV file', {
      jobId: processData.jobId,
      processId: processData.id,
      filePath
    });
    await prisma.job.update({
      where: { id: processData.jobId },
      data: {
        status: $Enums.Status.COMPLETED,
        logMessage: "No variants found to process"
      }
    });
    return;
  }

  const totalBatches = Math.ceil(variants.length / BATCH_SIZE);

  syncProductsLogger.info('CSV parsing completed', {
    jobId: processData.jobId,
    processId: processData.id,
    variantsCount: variants.length,
    totalBatches,
    batchSize: BATCH_SIZE
  });

  await prisma.job.update({
    where: { id: processData.jobId },
    data: {
      logMessage: `CSV parsed successfully: ${totalBatches} batches prepared for ${variants.length} variants`,
      data: {
        ...jobData,
        totalVariants: variants.length,
        totalBatches: totalBatches
      }
    }
  });

  await prisma.process.update({
    where: { id: processData.id },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: `CSV parsing completed successfully: ${variants.length} variants parsed into ${totalBatches} batches`
    }
  });

  if (variants.length > 0) {
    for (let i = 0; i < totalBatches; i++) {
      const startIndex = i * BATCH_SIZE;
      const endIndex = Math.min(startIndex + BATCH_SIZE, variants.length);
      const batch = variants.slice(startIndex, endIndex);

      await prisma.process.create({
        data: {
          jobId: processData.jobId,
          shopId: processData.shopId,
          type: $Enums.ProcessType.UPDATE_VARIANTS,
          status: $Enums.Status.PENDING,
          logMessage: `Variant update process for batch ${i + 1} (${batch.length} variants)`,
          data: JSON.parse(JSON.stringify({
            variants: batch,
            batchNumber: i + 1,
            totalBatches: totalBatches
          }))
        }
      });
    }
  }
};

export const parseCsv = async (process: Process) => {
  await runProcessWrapper(process, parseCsvTask);
};
