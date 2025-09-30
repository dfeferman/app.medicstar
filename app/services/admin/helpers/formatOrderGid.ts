export function formatOrderGid(orderId: string): string {
  return orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;
}
