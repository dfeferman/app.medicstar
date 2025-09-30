export function calculateDiscountedPrice(
  basePrice: number,
  totalDiscount: number,
  quantity: number
): number {
  return totalDiscount > 0 && quantity > 0
    ? basePrice - (totalDiscount / quantity)
    : basePrice;
}
