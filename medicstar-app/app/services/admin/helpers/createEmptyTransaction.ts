import { OrderTransactionsData } from "../order-transactions";

export function createEmptyTransactionData(): OrderTransactionsData {
  return {
    transactions: [],
    lastTransaction: undefined
  };
}
