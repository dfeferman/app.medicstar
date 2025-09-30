import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";
import { updateOrderTracking } from "../../../../utils/updateOrderTracking";
import { OrderData, LineItem } from "../../../../utils/trackingCsvParser";
import { TrackingStatus } from "../../../../constants/trackingStatus";
import { trackNumbersLogger } from "../../../../../lib/logger";

export interface TrackingUpdateProcessMetadata {
  ordersFoundInCsv: number;
  isLastOrder: boolean;
}

export interface TrackingUpdateProcessData {
  csvData: {
    orderName: string;
    lineItems: Array<LineItem>;
  };
  metadata: TrackingUpdateProcessMetadata;
}


const updateTrackingNumbersTask = async (process: ProcessWithShop) => {
  const processData = process.data as unknown as TrackingUpdateProcessData;
  const orderData: OrderData = {
    orderName: processData.csvData.orderName,
    lineItems: processData.csvData.lineItems
  };
  const ordersFoundInCsv = processData.metadata.ordersFoundInCsv;
  const isLastOrder = processData.metadata.isLastOrder;

  trackNumbersLogger.info('Starting tracking number update', {
    jobId: process.jobId,
    processId: process.id,
    shopDomain: process.shop.domain,
    orderName: orderData.orderName,
    lineItemsCount: orderData.lineItems.length,
    isLastOrder
  });

  if (!orderData) {
    throw new Error(`No order data found in process ${process.id}`);
  }

  const trackingUpdateResult = await updateOrderTracking({
    shopDomain: process.shop.domain,
    orderData
  });

  if (trackingUpdateResult.status === TrackingStatus.ERROR) {
    trackNumbersLogger.error('Tracking update failed', {
      jobId: process.jobId,
      processId: process.id,
      orderName: orderData.orderName,
      error: trackingUpdateResult.error
    });
    throw new Error(trackingUpdateResult.error || 'Failed to update tracking numbers');
  }

  const logMessage = trackingUpdateResult.status === TrackingStatus.SKIPPED
    ? `Order ${orderData.orderName} skipped: ${trackingUpdateResult.reason}`
    : `Order ${orderData.orderName} tracking updated successfully`;

  trackNumbersLogger.info('Tracking update completed', {
    jobId: process.jobId,
    processId: process.id,
    orderName: orderData.orderName,
    status: trackingUpdateResult.status,
    reason: trackingUpdateResult.reason
  });

  await prisma.process.update({
    where: { id: process.id },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: logMessage,
      data: JSON.parse(JSON.stringify({
        csvData: {
          orderName: orderData.orderName,
          lineItems: orderData.lineItems.map(item => ({
            sku: item.sku,
            trackingNumber: item.trackingNumber,
            carrierService: item.carrierService
          }))
        },
        processingResult: trackingUpdateResult
      })),
      updatedAt: new Date().toISOString()
    }
  });

  if (isLastOrder) {
    await prisma.process.create({
      data: {
        jobId: process.jobId,
        shopId: process.shopId,
        type: $Enums.ProcessType.FINISH,
        status: $Enums.Status.PENDING,
        logMessage: `Finish process created for job ${process.jobId} - waiting for all ${ordersFoundInCsv} order processes to complete`
      }
    });
  }
};

export const updateTrackingNumbers = async (process: any) => {
  await runProcessWrapper(process, updateTrackingNumbersTask);
};
