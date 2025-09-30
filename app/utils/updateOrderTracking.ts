import { updateOrderTrackingBySku } from "../services/admin/update-order-tracking-by-sku";
import { OrderData } from "./trackingCsvParser";
import { TrackingStatus } from "../constants/trackingStatus";

export interface TrackingUpdateResult {
  orderName: string;
  trackingNumber: string;
  status: TrackingStatus;
  reason?: string;
  error?: string;
}

interface UpdateOrderTrackingParams {
  shopDomain: string;
  orderData: OrderData;
}

export const updateOrderTracking = async ({
  shopDomain,
  orderData
}: UpdateOrderTrackingParams): Promise<TrackingUpdateResult> => {
  const baseResult = {
    orderName: orderData.orderName,
    trackingNumber: orderData.lineItems[0].trackingNumber
  };

  try {
    const result = await updateOrderTrackingBySku({
      shopDomain,
      orderName: orderData.orderName,
      carrier: orderData.lineItems[0].carrierService,
      trackingNumber: orderData.lineItems[0].trackingNumber,
      allSkus: orderData.lineItems.map(item => item.sku)
    });

    if (result.skipped) {
      return {
        ...baseResult,
        status: TrackingStatus.SKIPPED,
        reason: result.reason
      };
    }

    return {
      ...baseResult,
      status: TrackingStatus.SUCCESS
    };

  } catch (error) {
    const errorMsg = `${error instanceof Error ? error.message : 'Unknown error'}`;

    if (errorMsg.toLowerCase().includes('not found')) {
      return {
        ...baseResult,
        status: TrackingStatus.SKIPPED,
        reason: errorMsg
      };
    }

    return {
      ...baseResult,
      status: TrackingStatus.ERROR,
      error: errorMsg
    };
  }
};
