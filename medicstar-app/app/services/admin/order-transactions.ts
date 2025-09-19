import { unauthenticated } from "../../shopify.server";
import { formatOrderGid } from "./helpers/formatOrderGid";
import { hasTransactions } from "./helpers/hasTransactions";
import { createEmptyTransactionData } from "./helpers/createEmptyTransaction";
import { getLastTransaction } from "./helpers/getLastTransaction";
import { mapTransactionFields } from "../../utils/mappers/mapTransactionFields";

export type OrderTransaction = {
  id: string;
  kind: string;
  amount: number;
  gateway: string;
  status: string;
  processedAt?: string;
  createdAt: string;
  test: boolean;
};

export type OrderTransactionsData = {
  transactions: OrderTransaction[];
  lastTransaction?: OrderTransaction;
};

export type PaymentTransactionFields = {
  TX_ID: string;
  TX_Code: string;
  TX_Amount: string;
  PmtTransactionAmount: string;
};


export async function getOrderTransactions(
  shopDomain: string,
  orderId: string
): Promise<OrderTransactionsData | null> {
  try {
    const orderGid = formatOrderGid(orderId);
    const query = buildTransactionsQuery();

    const { admin: { graphql } } = await unauthenticated.admin(shopDomain);
    const res = await graphql(query, { variables: { id: orderGid } });
    const json = await res.json();


    if (!hasTransactions(json)) {
      return createEmptyTransactionData();
    }

    const transactions = mapTransactionFields(json.data.order.transactions);
    const lastTransaction = getLastTransaction(transactions);

    return {
      transactions,
      lastTransaction
    };

  } catch (error) {
    console.error("Error fetching order transactions:", error);
    return createEmptyTransactionData();
  }
}

function buildTransactionsQuery(): string {
  return `
    query getOrderTransactions($id: ID!) {
      order(id: $id) {
        id
        transactions(first: 50) {
          id
          kind
          amount
          gateway
          status
          processedAt
          createdAt
          test
        }
      }
    }
  `;
}
