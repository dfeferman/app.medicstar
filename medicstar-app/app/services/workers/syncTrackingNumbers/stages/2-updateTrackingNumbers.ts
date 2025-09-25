import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";
import { runProcessTrackingWrapper, TrackingProcessWithShop } from "../../helpers/runProcessTrackingWrapper";
import { updateOrderTrackingBySku } from "../../../admin/update-order-tracking-by-sku";
import type { TrackingProcess } from '@prisma/client'

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

const updateTrackingNumbersTask = async (process: TrackingProcessWithShop) => {
  const job = await prisma.trackingJob.findUnique({
    where: { id: process.jobId }
  });

  if (!job || !job.data) {
    throw new Error(`TrackingJob ${process.jobId} not found or missing data`);
  }

  const ordersData = (job.data as JobData).ordersData as OrderData[];
  if (!ordersData) {
    throw new Error(`No orders data found in job ${process.jobId}`);
  }

  console.log(`[updateTrackingNumbers] Processing ${ordersData.length} orders`);

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Get shop information
  const shop = await prisma.shop.findUnique({
    where: { id: process.shopId }
  });

  if (!shop) {
    throw new Error(`Shop ${process.shopId} not found`);
  }

  for (const orderData of ordersData) {
    try {
      console.log(`[updateTrackingNumbers] Processing order ${orderData.orderName} with ${orderData.lineItems.length} line items for tracking ${orderData.lineItems[0].trackingNumber}`);

      // Process all line items with the same tracking number together
      try {
        const result = await updateOrderTrackingBySku({
          shopDomain: shop.domain,
          orderName: orderData.orderName,
          sku: orderData.lineItems[0].sku, // Use first SKU as reference
          carrier: orderData.lineItems[0].carrierService,
          trackingNumber: orderData.lineItems[0].trackingNumber,
          allSkus: orderData.lineItems.map(item => item.sku) // Pass all SKUs to fulfill together
        });

        if (result.skipped) {
          console.log(`[updateTrackingNumbers] ⚠️ Skipped order ${orderData.orderName} with tracking ${orderData.lineItems[0].trackingNumber}: ${result.reason}`);
        } else {
          console.log(`[updateTrackingNumbers] ✅ Successfully updated order ${orderData.orderName} with ${orderData.lineItems.length} line items for tracking ${orderData.lineItems[0].trackingNumber} via carrier ${orderData.lineItems[0].carrierService}`);
        }
      } catch (lineItemError) {
        const errorMsg = `Failed to update tracking for order ${orderData.orderName} with tracking ${orderData.lineItems[0].trackingNumber}: ${lineItemError instanceof Error ? lineItemError.message : 'Unknown error'}`;
        console.error(`[updateTrackingNumbers] ❌ ${errorMsg}`);
        errors.push(errorMsg);
        errorCount++;
      }

      successCount++;
    } catch (orderError) {
      const errorMsg = `Failed to process order ${orderData.orderName}: ${orderError instanceof Error ? orderError.message : 'Unknown error'}`;
      console.error(`[updateTrackingNumbers] ❌ ${errorMsg}`);
      errors.push(errorMsg);
      errorCount++;
    }
  }

  console.log(`[updateTrackingNumbers] Completed: ${successCount} successful, ${errorCount} failed`);

  // Update job with results
  await prisma.trackingJob.update({
    where: { id: process.jobId },
    data: {
      data: {
        ...(job.data as JobData),
        updateResults: {
          successCount,
          errorCount,
          errors,
          completedAt: new Date().toISOString()
        }
      }
    }
  });

  // Mark update process as completed
  await prisma.trackingProcess.update({
    where: { id: process.id },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: `Updated tracking numbers: ${successCount} orders successful, ${errorCount} line items failed`
    }
  });

  // Create finish process
  await prisma.trackingProcess.create({
    data: {
      jobId: process.jobId,
      shopId: process.shopId,
      type: $Enums.TrackingProcessType.FINISH,
      status: $Enums.Status.PENDING,
      logMessage: `Finish tracking job process created for job ${process.jobId}`
    }
  });
};

export const updateTrackingNumbers = async (process: TrackingProcess) => {
  await runProcessTrackingWrapper(process, updateTrackingNumbersTask);
};
