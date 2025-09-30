export const SUPPORTED_CARRIERS = ['DPD', 'DHL'] as const;
export type SupportedCarrier = typeof SUPPORTED_CARRIERS[number];

export enum Carrier {
  DPD = 'DPD',
  DHL = 'DHL'
}
