import { unauthenticated } from "../../shopify.server";

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

    console.log(`Fetching transactions for order: ${orderGid}`);

    const { admin: { graphql } } = await unauthenticated.admin(shopDomain);
    const res = await graphql(query, { variables: { id: orderGid } });
    const json = await res.json();

    logFullResponse(json); // TODO: Remove this

    if (!hasTransactions(json)) {
      console.log("No transactions found for order");
      return createEmptyTransactionData();
    }

    const transactions = transformTransactionData(json.data.order.transactions);
    const lastTransaction = getLastTransaction(transactions);

    // logTransactionSummary(transactions, lastTransaction, orderId);

    return {
      transactions,
      lastTransaction
    };

  } catch (error) {
    console.error("Error fetching order transactions:", error);
    return createEmptyTransactionData();
  }
}

/**
 * Maps Shopify transaction data to NAV payment fields
 */
export function mapTransactionToPaymentFields(transactionData: OrderTransactionsData | null): PaymentTransactionFields {
  if (!transactionData || !transactionData.lastTransaction) {
    return createEmptyPaymentFields();
  }

  const lastTx = transactionData.lastTransaction;
  // console.log('=== DEBUG: About to map gateway ===');
  // console.log('Gateway value:', lastTx.gateway);
  // console.log('Gateway type:', typeof lastTx.gateway);

  const txCode = mapGatewayToTxCode(lastTx.gateway);
  // console.log('Mapped TX_Code:', txCode);

  // logPaymentFieldMapping(lastTx, txCode);

  return {
    TX_ID: cleanTransactionId(lastTx.id),
    TX_Code: txCode,
    TX_Amount: lastTx.amount.toString(),
    PmtTransactionAmount: lastTx.amount.toString()
  };
}

/**
 * Formats order ID to GID format if needed
 */
function formatOrderGid(orderId: string): string {
  return orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`;
}

/**
 * Builds the GraphQL query for fetching order transactions
 */
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

/**
 * Checks if the response contains transactions
 */
function hasTransactions(json: any): boolean {
  return json?.data?.order?.transactions && Array.isArray(json.data.order.transactions);
}

/**
 * Creates empty transaction data structure
 */
function createEmptyTransactionData(): OrderTransactionsData {
  return {
    transactions: [],
    lastTransaction: undefined
  };
}

/**
 * Creates empty payment fields structure
 */
function createEmptyPaymentFields(): PaymentTransactionFields {
  return {
    TX_ID: "",
    TX_Code: "",
    TX_Amount: "0",
    PmtTransactionAmount: "0"
  };
}

/**
 * Transforms raw transaction data from GraphQL response
 */
function transformTransactionData(rawTransactions: any[]): OrderTransaction[] {
  return rawTransactions.map((tx: any, index: number) => {
    // console.log(`--- Processing Transaction ${index + 1} ---`);
    // console.log('Original transaction:', JSON.stringify(tx, null, 2));

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

    // console.log('Transformed transaction:', JSON.stringify(transaction, null, 2));
    // console.log('--- End Processing Transaction ---');

    return transaction;
  });
}


function getLastTransaction(transactions: OrderTransaction[]): OrderTransaction | undefined {
  return transactions.length > 0 ? transactions[transactions.length - 1] : undefined;
}

function mapGatewayToTxCode(gateway: string): string {
  const gatewayLower = gateway.toLowerCase();

  if (gatewayLower.includes('rechnung') || gatewayLower.includes('invoice')) {
    return 'RECHNUNG';
  } else if (gatewayLower.includes('sepa')) {
    return 'SEPA-LS';
  } else if (gatewayLower.includes('paypal')) {
    return 'PAYPAL';
  } else if (gatewayLower.includes('vorkasse') || gatewayLower.includes('prepayment')) {
    return 'VORKASSE';
  } else {
    return gateway.toUpperCase();
  }
}


function cleanTransactionId(transactionId: string): string {
  return transactionId.replace('gid://shopify/OrderTransaction/', '');
}

/**
 * Logs the full GraphQL response
 */
function logFullResponse(json: any): void {
  console.log('=== FULL ORDER TRANSACTIONS RESPONSE ===');
  console.log(JSON.stringify(json, null, 2));
  console.log('=== END FULL RESPONSE ===');
}

/**
 * Logs transaction summary information
 */
function logTransactionSummary(
  transactions: OrderTransaction[],
  lastTransaction: OrderTransaction | undefined,
  orderId: string
): void {
  console.log('=== TRANSACTION SUMMARY ===');
  console.log(`Found ${transactions.length} transactions for order ${orderId}`);
  console.log('Last transaction:', JSON.stringify(lastTransaction, null, 2));
  console.log('All transactions:', JSON.stringify(transactions, null, 2));
  console.log('=== END TRANSACTION SUMMARY ===');
}

/**
 * Logs payment field mapping information
 */
function logPaymentFieldMapping(lastTx: OrderTransaction, txCode: string): void {
  console.log('=== PAYMENT FIELD MAPPING ===');
  console.log('Original gateway:', lastTx.gateway);
  console.log('Mapped TX_Code:', txCode);
  console.log('Transaction amount:', lastTx.amount);
  console.log('Transaction ID:', lastTx.id);
  console.log('=== END PAYMENT FIELD MAPPING ===');
}
