import { OrderTransaction } from "../../services/admin/order-transactions";

export function mapTransactionFields(rawTransactions: any[]): OrderTransaction[] {
  return rawTransactions.map((tx: any, index: number) => {

    const transaction: OrderTransaction = {
      id: tx.id,
      kind: tx.kind,
      amount: parseFloat(tx.amount),
      gateway: tx.gateway,
      status: tx.status,
      processedAt: tx.processedAt,
      createdAt: tx.createdAt,
      test: tx.test
    };

    return transaction;
  });
}
