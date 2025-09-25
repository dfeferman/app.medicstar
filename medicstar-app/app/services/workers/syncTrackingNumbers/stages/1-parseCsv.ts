import "dotenv/config.js";
import * as fs from "fs";
import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";
import { parseTrackingCsv } from "../../../../utils/trackingCsvParser";
import { Process } from "@prisma/client";

type JsonObject = Record<string, unknown>;

interface JobData extends JsonObject {
  filePath: string;
}

const parseTrackingCsvTask = async (process: ProcessWithShop) => {
  const job = await prisma.job.findUnique({
    where: { id: process.jobId }
  });

  if (!job || !job.data) {
    throw new Error(`TrackingJob ${process.jobId} not found or missing data`);
  }

  const filePath = (job.data as JobData).filePath;
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');

  const { parsedOrders, validLineItemsCount, totalCsvRows } = parseTrackingCsv(fileContent);

  await prisma.job.update({
    where: { id: process.jobId },
    data: {
      logMessage: `CSV parsed successfully: ${parsedOrders.length} orders with tracking data`,
      data: JSON.parse(JSON.stringify({
        ...(job.data as JobData),
        totalOrders: parsedOrders.length,
        validLineItemsCount: validLineItemsCount,
        totalCsvRows: totalCsvRows
      }))
    }
  });

  await prisma.process.update({
    where: { id: process.id },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: `Parsed CSV: ${validLineItemsCount} line items processed, ${parsedOrders.length} orders found`,
      data: JSON.parse(JSON.stringify({
        parsedOrders: parsedOrders,
      })),
      updatedAt: new Date().toISOString()
    }
  });

  for (let i = 0; i < parsedOrders.length; i++) {
    const orderData = parsedOrders[i];
    await prisma.process.create({
      data: {
        jobId: process.jobId,
        shopId: process.shopId,
        type: $Enums.ProcessType.UPDATE_TRACKING_NUMBERS,
        status: $Enums.Status.PENDING,
        logMessage: `Update tracking numbers for order ${orderData.orderName} (${orderData.lineItems.length} line items)`,
        data: JSON.parse(JSON.stringify({
          csvData: {
            orderName: orderData.orderName,
            trackingNumber: orderData.lineItems[0].trackingNumber,
            lineItemsCount: orderData.lineItems.length,
            lineItems: orderData.lineItems.map(item => ({
              sku: item.sku,
              trackingNumber: item.trackingNumber,
              carrierService: item.carrierService
            }))
          },
          metadata: {
            orderIndex: i + 1,
            totalOrders: parsedOrders.length,
            isLastOrder: i === parsedOrders.length - 1
          }
        }))
      }
    });
  }
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    console.warn(`[parseTrackingCsv] Failed to clean up file ${filePath}:`, error);
  }
};

export const parseCsv = async (process: Process) => {
  await runProcessWrapper(process, parseTrackingCsvTask);
};
