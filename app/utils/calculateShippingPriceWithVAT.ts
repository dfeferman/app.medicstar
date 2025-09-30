export const calculateShippingPriceWithVAT = (shippingPrice: string, taxRate: number = 0): string => {
  return (parseFloat(shippingPrice) * (1 + taxRate)).toFixed(2);
};
