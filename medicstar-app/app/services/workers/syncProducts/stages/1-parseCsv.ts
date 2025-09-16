import * as path from "path";
import * as fs from "fs";
import XLSX from "xlsx";
import { $Enums } from "@prisma/client";
import prisma from "../../../../db.server";
import { buildLowerKeyMap, pickFirst, toStringOrEmpty, toIntegerOrZero } from "../../../../utils/xlsx";

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

export const parseCsv = async (job: any) => {
  console.log(`[parseCsv] Starting CSV parsing for Job ID: ${job.id}`);

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
      where: { id: job.id },
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
    where: { id: job.id },
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

  // Update the existing PARSE_FILE process to be the first UPDATE_VARIANTS batch
  const parseProcess = await prisma.process.findFirst({
    where: {
      jobId: job.id,
      type: $Enums.ProcessType.PARSE_FILE
    }
  });

  if (parseProcess && variants.length > 0) {
    const firstBatch = variants.slice(0, 250);
    await prisma.process.update({
      where: { id: parseProcess.id },
      data: {
        type: $Enums.ProcessType.CREATE_NEXT_PROCESS,
        status: $Enums.Status.PENDING,
        logMessage: `Create next process for batch 1 (${firstBatch.length} variants)`,
        data: {
          variants: firstBatch as any,
          batchNumber: 1,
          totalBatches: totalBatches
        }
      }
    });
  }

  console.log(`[parseCsv] ✅ CSV parsing completed for Job ID: ${job.id}`);
};
