export function selectPhoneNumber(
  customerPhone?: string,
  billingPhone?: string,
  shippingPhone?: string
): string {
  return customerPhone || billingPhone || shippingPhone || '';
}
