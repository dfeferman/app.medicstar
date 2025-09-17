import * as path from "path";
import * as fs from "fs";
import * as process from "process";
import XLSX from "xlsx";
import { $Enums } from "@prisma/client";
import prisma from "../../../../db.server";
import { buildLowerKeyMap, pickFirst, toStringOrEmpty, toIntegerOrZero } from "../../../../utils/xlsx";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";

type RowRecord = Record<string, unknown>;

const headerAliases: Record<string, string[]> = {
  sku: ["produktnummer"],
  quantity: ["lagerbestand"],
  price: ["ek netto"],
};

interface VariantData {
  sku: string;
  price: string;
  quantity: string;
}

const BATCH_SIZE = 250;

const parseCsvTask = async (processData: ProcessWithShop) => {
  // Get job data from the process
  const job = await prisma.job.findUnique({
    where: { id: processData.jobId },
    select: { data: true }
  });

  if (!job) {
    throw new Error(`Job ${processData.jobId} not found`);
  }

  const jobData = job.data as any;
  const filePath = jobData?.filePath;

  if (!filePath) {
    throw new Error("No file path found in job data");
  }

  // Convert relative path to absolute path
  const absoluteFilePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absoluteFilePath)) {
    throw new Error(`File does not exist: ${absoluteFilePath}`);
  }

  const workbook = XLSX.readFile(absoluteFilePath);
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<RowRecord>(sheet, { defval: null });

  const variants: VariantData[] = [];

  // Parse all rows and extract variant data
  for (const row of rows) {
    const lower = buildLowerKeyMap(row);

    const sku = toStringOrEmpty(pickFirst(lower, headerAliases.sku));
    const quantity = toIntegerOrZero(pickFirst(lower, headerAliases.quantity));
    const price = toStringOrEmpty(pickFirst(lower, headerAliases.price));

    // Only include rows with valid SKU
    if (sku && sku.trim() !== "") {
      variants.push({
        sku: sku.trim(),
        price: price,
        quantity: quantity.toString(),
      });
    }
  }

  console.log(`[parseCsv] Found ${variants.length} variants to process`);

  if (variants.length === 0) {
    await prisma.job.update({
      where: { id: processData.jobId },
      data: {
        status: $Enums.Status.COMPLETED,
        logMessage: "No variants found to process"
      }
    });
    return;
  }

  // Create processes in batches
  const totalBatches = Math.ceil(variants.length / BATCH_SIZE);
  console.log(`[parseCsv] Prepared ${totalBatches} batches with batch size ${BATCH_SIZE}`);

  // Update job with parsing results
  await prisma.job.update({
    where: { id: processData.jobId },
    data: {
      logMessage: `CSV parsed successfully: ${totalBatches} batches prepared for ${variants.length} variants`,
      data: {
        ...jobData,
        totalVariants: variants.length,
        totalBatches: totalBatches,
        parsedAt: new Date().toISOString()
      }
    }
  });

  // Mark the current PARSE_FILE process as COMPLETED
  const parseProcess = await prisma.process.findFirst({
    where: {
      jobId: processData.jobId,
      type: $Enums.ProcessType.PARSE_FILE,
      status: $Enums.Status.PROCESSING
    }
  });

  if (parseProcess) {
    await prisma.process.update({
      where: { id: parseProcess.id },
      data: {
        status: $Enums.Status.COMPLETED,
        logMessage: `CSV parsing completed successfully: ${variants.length} variants parsed into ${totalBatches} batches`
      }
    });

    // Create multiple UPDATE_VARIANTS processes
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
            data: {
              variants: batch as any,
              batchNumber: i + 1,
              totalBatches: totalBatches
            }
          }
        });
      }

      console.log(`[parseCsv] Created ${totalBatches} UPDATE_VARIANTS processes for job ${processData.jobId}`);
    }
  }

  console.log(`[parseCsv] ✅ CSV parsing completed for Job ID: ${processData.jobId}`);
};

export const parseCsv = async (process: any) => {
  await runProcessWrapper(process, parseCsvTask);
};
