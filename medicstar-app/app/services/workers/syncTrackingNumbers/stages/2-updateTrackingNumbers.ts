import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";
import { updateOrderTrackingBySku } from "../../../admin/update-order-tracking-by-sku";

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

  const updateTrackingNumbersTask = async (process: ProcessWithShop) => {
    const processData = process.data as any;
    const orderData = processData.csvData as OrderData;
    const orderIndex = processData.metadata.orderIndex as number;
    const totalOrders = processData.metadata.totalOrders as number;
    const isLastOrder = processData.metadata.isLastOrder as boolean;

  if (!orderData) {
    throw new Error(`No order data found in process ${process.id}`);
  }

  console.log(`[updateTrackingNumbers] Processing order ${orderData.orderName} (${orderIndex}/${totalOrders})`);

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];
  const results: any[] = [];

  // Get shop information
  const shop = await prisma.shop.findUnique({
    where: { id: process.shopId }
  });

  if (!shop) {
    throw new Error(`Shop ${process.shopId} not found`);
  }

  console.log(`[updateTrackingNumbers] Processing ${orderData.lineItems.length} line items for order: ${orderData.orderName}`);

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
      results.push({
        orderName: orderData.orderName,
        trackingNumber: orderData.lineItems[0].trackingNumber,
        status: 'skipped',
        reason: result.reason
      });
    } else {
      console.log(`[updateTrackingNumbers] ✅ Successfully updated order ${orderData.orderName} with ${orderData.lineItems.length} line items for tracking ${orderData.lineItems[0].trackingNumber} via carrier ${orderData.lineItems[0].carrierService}`);
      results.push({
        orderName: orderData.orderName,
        trackingNumber: orderData.lineItems[0].trackingNumber,
        status: 'success',
        fulfillmentId: result.fulfillmentId,
        lineItemsFulfilled: result.lineItemsFulfilled
      });
    }
  } catch (lineItemError) {
    const errorMsg = `${lineItemError instanceof Error ? lineItemError.message : 'Unknown error'}`;

    // Check if the error is about order not found - if so, skip it
    if (errorMsg.toLowerCase().includes('not found')) {
      console.log(`[updateTrackingNumbers] ⚠️ Skipping order ${orderData.orderName}: ${errorMsg}`);
      results.push({
        orderName: orderData.orderName,
        trackingNumber: orderData.lineItems[0].trackingNumber,
        status: 'skipped',
        reason: errorMsg
      });
      // Don't increment errorCount for skipped orders
      // Mark as completed successfully
    } else {
      console.error(`[updateTrackingNumbers] ❌ ${errorMsg}`);
      errors.push(errorMsg);
      results.push({
        orderName: orderData.orderName,
        trackingNumber: orderData.lineItems[0].trackingNumber,
        status: 'error',
        error: errorMsg
      });
      errorCount++;
      // Re-throw the error to fail this process for real errors
      throw lineItemError;
    }
  }

  // If we reach here, the order was processed successfully (including skipped orders)
  successCount = 1;
  console.log(`[updateTrackingNumbers] Order ${orderData.orderName} completed successfully`);

  // Determine the appropriate log message based on results
  const result = results[0]; // There should be only one result
  const logMessage = result.status === 'skipped'
    ? `Order ${orderData.orderName} skipped: ${result.reason}`
    : `Order ${orderData.orderName} tracking updated successfully`;

  // Mark this process as completed
  await prisma.process.update({
    where: { id: process.id },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: logMessage,
      data: {
        // CSV File Data (original input)
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
        // Processing Results
        processingResults: {
          status: result.status,
          results: results,
          successCount: successCount,
          errorCount: errorCount
        },
        // Process Metadata
        metadata: {
          orderIndex: orderIndex,
          totalOrders: totalOrders,
          isLastOrder: isLastOrder
        }
      },
      updatedAt: new Date().toISOString()
    }
  });

  // Only the last order process creates the finish process
  if (isLastOrder) {
    await prisma.process.create({
      data: {
        jobId: process.jobId,
        shopId: process.shopId,
        type: $Enums.ProcessType.FINISH,
        status: $Enums.Status.PENDING,
        logMessage: `Finish process created for job ${process.jobId} - waiting for all ${totalOrders} order processes to complete`
      }
    });
    console.log(`[updateTrackingNumbers] Finish process created for job ${process.jobId}`);
  }

  console.log(`[updateTrackingNumbers] Process completed for order ${orderData.orderName}`);
};

export const updateTrackingNumbers = async (process: any) => {
  await runProcessWrapper(process, updateTrackingNumbersTask);
};
