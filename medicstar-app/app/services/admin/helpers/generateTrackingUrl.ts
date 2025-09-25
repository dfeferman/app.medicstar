import { SupportedCarrier, SUPPORTED_CARRIERS, Carrier } from "../../../constants/deliveryService";

export const generateTrackingUrl = (carrier: SupportedCarrier, trackingNumber: string): string => {
  const urlMap: Record<SupportedCarrier, string> = {
    [Carrier.DPD]: `https://tracking.dpd.de/status/en_US/parcel/${trackingNumber}`,
    [Carrier.DHL]: `https://www.dhl.com/de-en/home/tracking/tracking-parcel.html?submit=1&tracking-id=${trackingNumber}`
  };

  const trackingUrl = urlMap[carrier];
  if (!trackingUrl) {
    throw new Error(`Unsupported carrier for tracking URL: ${carrier}. Only ${SUPPORTED_CARRIERS.join(', ')} are supported.`);
  }

  return trackingUrl;
};
