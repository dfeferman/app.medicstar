import "dotenv/config.js";
import * as fs from "fs";
import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";
import { parseTrackingCsv } from "../../../../utils/trackingCsvParser";
import { Process } from "@prisma/client";
import { trackNumbersLogger } from "../../../../../lib/logger";
import { cleanupDownloadedFile } from "../../helpers/removeFile";

type JsonObject = Record<string, unknown>;

interface JobData extends JsonObject {
  filePath: string;
}

interface OrderData {
  orderName: string;
  lineItems: Array<{
    sku: string;
    trackingNumber: string;
    carrierService: string;
  }>;
}

const createTrackingNumberUpdateProcesses = async (
  parsedOrders: OrderData[],
  process: ProcessWithShop
): Promise<void> => {
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
            lineItems: orderData.lineItems.map(item => ({
              sku: item.sku,
              trackingNumber: item.trackingNumber,
              carrierService: item.carrierService
            }))
          },
          metadata: {
            ordersFoundInCsv: parsedOrders.length,
            isLastOrder: i === parsedOrders.length - 1
          }
        }))
      }
    });
  }
};

const parseTrackingCsvTask = async (process: ProcessWithShop) => {
  trackNumbersLogger.info('Starting tracking CSV parsing', {
    jobId: process.jobId,
    processId: process.id,
    shopDomain: process.shop.domain
  });

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

  trackNumbersLogger.info('Tracking CSV parsing completed', {
    jobId: process.jobId,
    processId: process.id,
    totalCsvRows,
    validLineItemsCount,
    ordersFound: parsedOrders.length
  });

  await prisma.job.update({
    where: { id: process.jobId },
    data: {
      logMessage: `CSV parsed successfully: ${parsedOrders.length} orders with tracking data`,
      data: JSON.parse(JSON.stringify({
        ...(job.data as JobData),
        totalCsvRows: totalCsvRows,
        validLineItemsCount: validLineItemsCount,
        ordersFoundInCsv: parsedOrders.length
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

  if (parsedOrders.length === 0) {
    trackNumbersLogger.info('No orders starting with OS found in CSV, creating finish process', {
      jobId: process.jobId,
      processId: process.id
    });

    await prisma.process.create({
      data: {
        jobId: process.jobId,
        shopId: process.shopId,
        type: $Enums.ProcessType.FINISH,
        status: $Enums.Status.PENDING,
        logMessage: `Finish process created for job ${process.jobId} - no orders found in CSV`
      }
    });
  } else {
    await createTrackingNumberUpdateProcesses(parsedOrders, process);
  }
  await cleanupDownloadedFile(process.jobId);
};

export const parseCsv = async (process: Process) => {
  await runProcessWrapper(process, parseTrackingCsvTask);
};
