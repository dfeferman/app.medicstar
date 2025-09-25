import { unauthenticated } from "../../shopify.server";

interface FulfillmentOrderLineItem {
  id: string;
  totalQuantity: number;
  remainingQuantity: number;
  sku: string;
}

interface FulfillmentOrderLineItemEdge {
  node: FulfillmentOrderLineItem;
}

interface FulfillmentOrder {
  id: string;
  lineItems: {
    edges: FulfillmentOrderLineItemEdge[];
  };
}

interface FulfillmentOrderEdge {
  node: FulfillmentOrder;
}

interface Order {
  id: string;
  name: string;
  fulfillmentOrders: {
    edges: FulfillmentOrderEdge[];
  };
}

interface OrderEdge {
  node: Order;
}

interface FindOrderResponse {
  data?: {
    orders: {
      edges: OrderEdge[];
    };
  };
}

export async function findOrderByName(shopDomain: string, orderName: string) {
  const { admin: { graphql } } = await unauthenticated.admin(shopDomain);

  const orderQuery = `#graphql
    query findOrderByName($query: String!) {
      orders(first: 1, query: $query) {
        edges {
          node {
            id
            name
            fulfillmentOrders(first: 10) {
              edges {
                node {
                  id
                  lineItems(first: 50) {
                    edges {
                      node {
                        id
                        totalQuantity
                        remainingQuantity
                        sku
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const orderQueryResponse = await graphql(orderQuery, {
    variables: { query: `name:${orderName}` }
  });

  const orderQueryData: FindOrderResponse = await orderQueryResponse.json();

  if (!orderQueryData.data?.orders?.edges?.length) {
    throw new Error(`Order ${orderName} not found`);
  }

  return orderQueryData.data.orders.edges[0].node;
}

export type { Order, FulfillmentOrder, FulfillmentOrderLineItem, FulfillmentOrderLineItemEdge };
