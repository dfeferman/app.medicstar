import type { OrderTransactionsData, PaymentTransactionFields } from '../../services/admin/order-transactions';
import { mapGatewayToTxCode } from './mapGatewayToTxCode';
import { cleanTransactionId } from '../cleanTransactionId';
import { createEmptyPaymentFields } from '../createEmptyPaymentFields';

export function mapTransactionToPaymentFields(transactionData: OrderTransactionsData | null): PaymentTransactionFields {
  if (!transactionData || !transactionData.lastTransaction) {
    return createEmptyPaymentFields();
  }

  const lastTx = transactionData.lastTransaction;
  const txCode = mapGatewayToTxCode(lastTx.gateway);

  return {
    TX_ID: cleanTransactionId(lastTx.id),
    TX_Code: txCode,
    TX_Amount: lastTx.amount.toString(),
    PmtTransactionAmount: lastTx.amount.toString()
  };
}
