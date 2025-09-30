import { SupportedCarrier, SUPPORTED_CARRIERS } from "../constants/deliveryService";

export interface LineItem {
  sku: string;
  carrierService: SupportedCarrier;
  trackingNumber: string;
}

export interface OrderData {
  orderName: string;
  lineItems: LineItem[];
}

type LineItemsByTrackingNumber = Record<string, LineItem[]>;
type OrdersByTrackingNumber = Record<string, LineItemsByTrackingNumber>;

interface TrackingCsvParseResult {
  parsedOrders: OrderData[];
  validLineItemsCount: number;
  totalCsvRows: number;
}

export const parseTrackingCsv = (fileContent: string): TrackingCsvParseResult => {
  const csvLines = fileContent.split('\n').filter(line => line.trim());
  const ordersByTrackingNumber: OrdersByTrackingNumber = {};
  let validLineItemsCount = 0;

  csvLines.forEach((csvLine) => {
    const columns = csvLine.split('|');

    if (columns.length < 34) return;

    const orderName = columns[2]?.trim();
    const carrierService = columns[3]?.trim();
    const sku = columns[16]?.trim();
    const trackingNumber = columns[33]?.trim();

    if (!orderName || !orderName.startsWith('OS')) return;

    if (!carrierService || !SUPPORTED_CARRIERS.includes(carrierService.toUpperCase() as SupportedCarrier)) return;

    if (!sku || !trackingNumber) return;

    const lineItem: LineItem = {
      sku: sku,
      carrierService: carrierService.toUpperCase() as SupportedCarrier,
      trackingNumber: trackingNumber
    };

    if (!ordersByTrackingNumber[orderName]) {
      ordersByTrackingNumber[orderName] = {};
    }
    if (!ordersByTrackingNumber[orderName][trackingNumber]) {
      ordersByTrackingNumber[orderName][trackingNumber] = [];
    }
    ordersByTrackingNumber[orderName][trackingNumber].push(lineItem);
    validLineItemsCount++;
  });

  const parsedOrders: OrderData[] = [];
  for (const orderName in ordersByTrackingNumber) {
    for (const trackingNumber in ordersByTrackingNumber[orderName]) {
      const orderData: OrderData = {
        orderName: orderName,
        lineItems: ordersByTrackingNumber[orderName][trackingNumber]
      };
      parsedOrders.push(orderData);
    }
  }

  return {
    parsedOrders,
    validLineItemsCount,
    totalCsvRows: csvLines.length
  };
};

export type { SupportedCarrier, TrackingCsvParseResult };
