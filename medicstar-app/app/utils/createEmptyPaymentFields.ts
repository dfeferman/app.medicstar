import type { PaymentTransactionFields } from '../services/admin/order-transactions';

export function createEmptyPaymentFields(): PaymentTransactionFields {
  return {
    TX_ID: "",
    TX_Code: "",
    TX_Amount: "0",
    PmtTransactionAmount: "0"
  };
}
