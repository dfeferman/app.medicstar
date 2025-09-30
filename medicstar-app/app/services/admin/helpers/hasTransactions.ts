export function hasTransactions(json: any): boolean {
  return json?.data?.order?.transactions && Array.isArray(json.data.order.transactions);
}
