import { OrderTransaction } from "../order-transactions";

export function getLastTransaction(transactions: OrderTransaction[]): OrderTransaction | undefined {
  return transactions.length > 0 ? transactions[transactions.length - 1] : undefined;
}
