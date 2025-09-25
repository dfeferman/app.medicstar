import "dotenv/config.js";
import * as fs from "fs";
import prisma from "../../../../db.server";
import type { TrackingProcess } from '@prisma/client'
import { $Enums } from "@prisma/client";
import { runProcessTrackingWrapper, TrackingProcessWithShop } from "../../helpers/runProcessTrackingWrapper";

type SupportedCarrier = 'DPD' | 'DHL';

interface LineItem {
  sku: string;
  carrierService: SupportedCarrier;
  trackingNumber: string;
}

interface OrderData {
  orderName: string;
  lineItems: LineItem[];
}

type JsonObject = Record<string, unknown>;

interface JobData extends JsonObject {
  filePath: string;
}

const parseTrackingCsvTask = async (process: TrackingProcessWithShop) => {
  const job = await prisma.trackingJob.findUnique({
    where: { id: process.jobId }
  });

  if (!job || !job.data) {
    throw new Error(`TrackingJob ${process.jobId} not found or missing data`);
  }

  const filePath = (job.data as JobData).filePath;
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  console.log(`[parseTrackingCsv] Parsing file: ${filePath}`);

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim());

  // Dictionary to group line items by order name and tracking number
  const orders: Record<string, Record<string, LineItem[]>> = {};
  let validRows = 0;

  lines.forEach((line, index) => {
    const columns = line.split('|');

    if (columns.length < 34) return;

    const orderName = columns[2]?.trim(); // Column 3 (0-indexed)
    const carrierService = columns[3]?.trim(); // Column 4 (0-indexed)
    const sku = columns[16]?.trim(); // Column 17 (0-indexed)
    const trackingNumber = columns[33]?.trim(); // Column 34 (0-indexed)

    // Only process orders starting with "OS"
    if (!orderName || !orderName.startsWith('OS')) return;

    // Only process DPD and DHL carriers
    const supportedCarriers: SupportedCarrier[] = ['DPD', 'DHL'];
    if (!carrierService || !supportedCarriers.includes(carrierService.toUpperCase() as SupportedCarrier)) return;

    if (!sku || !trackingNumber) return;

    // Create line item
    const lineItem: LineItem = {
      sku: sku,
      carrierService: carrierService.toUpperCase() as SupportedCarrier,
      trackingNumber: trackingNumber
    };

    // Add to the order, grouped by tracking number
    if (!orders[orderName]) {
      orders[orderName] = {};
    }
    if (!orders[orderName][trackingNumber]) {
      orders[orderName][trackingNumber] = [];
    }
    orders[orderName][trackingNumber].push(lineItem);
    validRows++;
  });

  // Convert to the requested JSON format, flattening by tracking number
  const result: OrderData[] = [];
  for (const orderName in orders) {
    for (const trackingNumber in orders[orderName]) {
      const orderData: OrderData = {
        orderName: orderName,
        lineItems: orders[orderName][trackingNumber]
      };
      result.push(orderData);
    }
  }

  console.log(`[parseTrackingCsv] Parsed ${validRows} valid rows`);
  console.log(`[parseTrackingCsv] Found ${result.length} orders with tracking data`);

  // Update job with parsed data
  await prisma.trackingJob.update({
    where: { id: process.jobId },
    data: {
      logMessage: `CSV parsed successfully: ${result.length} orders with tracking data`,
      data: JSON.parse(JSON.stringify({
        ...(job.data as JobData),
        ordersData: result,
        parseResults: {
          processedRows: validRows,
          ordersCount: result.length,
          completedAt: new Date().toISOString()
        }
      }))
    }
  });

  // Mark parse process as completed
  await prisma.trackingProcess.update({
    where: { id: process.id },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: `Parsed CSV: ${validRows} rows processed, ${result.length} orders found`
    }
  });

  // Create update process
  await prisma.trackingProcess.create({
    data: {
      jobId: process.jobId,
      shopId: process.shopId,
      type: $Enums.TrackingProcessType.UPDATE_TRACKING_NUMBERS,
      status: $Enums.Status.PENDING,
      logMessage: `Update tracking numbers process created for job ${process.jobId}`
    }
  });

  // Clean up the downloaded file
  try {
    fs.unlinkSync(filePath);
    console.log(`[parseTrackingCsv] Cleaned up file: ${filePath}`);
  } catch (error) {
    console.warn(`[parseTrackingCsv] Failed to clean up file ${filePath}:`, error);
  }
};

export const parseCsv = async (process: TrackingProcess) => {
  await runProcessTrackingWrapper(process, parseTrackingCsvTask);
};
