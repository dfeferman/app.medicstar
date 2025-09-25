import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";
import { updateOrderTracking } from "../../../../utils/updateOrderTracking";
import { OrderData, LineItem } from "../../../../utils/trackingCsvParser";
import { TrackingStatus } from "../../../../constants/trackingStatus";

export interface TrackingUpdateProcessMetadata {
  orderIndex: number;
  ordersFoundInCsv: number;
  isLastOrder: boolean;
}

export interface TrackingUpdateProcessData {
  csvData: {
    orderName: string;
    trackingNumber: string;
    lineItemsCount: number;
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

  if (!orderData) {
    throw new Error(`No order data found in process ${process.id}`);
  }

  const trackingUpdateResult = await updateOrderTracking({
    shopDomain: process.shop.domain,
    orderData
  });

  if (trackingUpdateResult.status === TrackingStatus.ERROR) {
    throw new Error(trackingUpdateResult.error || 'Failed to update tracking numbers');
  }

  const logMessage = trackingUpdateResult.status === TrackingStatus.SKIPPED
    ? `Order ${orderData.orderName} skipped: ${trackingUpdateResult.reason}`
    : `Order ${orderData.orderName} tracking updated successfully`;

  await prisma.process.update({
    where: { id: process.id },
    data: {
      status: $Enums.Status.COMPLETED,
      logMessage: logMessage,
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
