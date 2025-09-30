export function cleanTransactionId(transactionId: string): string {
  return transactionId.replace('gid://shopify/OrderTransaction/', '');
}
