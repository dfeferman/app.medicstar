// import { unauthenticated } from "../../shopify.server";

// interface FulfillmentOrderLineItem {
//   id: string;
//   totalQuantity: number;
//   sku: string;
// }

// interface FulfillmentOrder {
//   id: string;
//   lineItems: {
//     edges: Array<{
//       node: FulfillmentOrderLineItem;
//     }>;
//   };
// }

// interface Order {
//   id: string;
//   name: string;
//   fulfillmentOrders: {
//     edges: Array<{
//       node: FulfillmentOrder;
//     }>;
//   };
// }

// export const getOrderByName = async (shopDomain: string, orderName: string) => {
//   console.log(`[getOrderByName] Looking up order ${orderName} in shop ${shopDomain}`);

//   try {
//     const { admin: { graphql } } = await unauthenticated.admin(shopDomain);

//     const findOrderQuery = `#graphql
//       query findOrderByName($query: String!) {
//         orders(first: 1, query: $query) {
//           edges {
//             node {
//               id
//               name
//               fulfillmentOrders(first: 10) {
//                 edges {
//                   node {
//                     id
//                     lineItems(first: 50) {
//                       edges {
//                         node {
//                           id
//                           totalQuantity
//                           sku
//                         }
//                       }
//                     }
//                   }
//                 }
//               }
//             }
//           }
//         }
//       }
//     `;

//     const findOrderResponse = await graphql(findOrderQuery, {
//       variables: { query: `name:${orderName}` }
//     });

//     const findOrderData = await findOrderResponse.json();

//     if (!findOrderData.data?.orders?.edges?.length) {
//       throw new Error(`Order ${orderName} not found`);
//     }

//     const order = findOrderData.data.orders.edges[0].node as Order;
//     console.log(`[getOrderByName] Found order ${order.id} (${order.name})`);

//     if (!order.fulfillmentOrders.edges.length) {
//       throw new Error(`Order ${orderName} has no fulfillment orders`);
//     }

//     // Get the first fulfillment order (assuming single fulfillment)
//     const fulfillmentOrder = order.fulfillmentOrders.edges[0].node;
//     console.log(`[getOrderByName] Using fulfillment order ${fulfillmentOrder.id}`);

//     // Prepare fulfillment order line items
//     const fulfillmentOrderLineItems = fulfillmentOrder.lineItems.edges.map(edge => ({
//       id: edge.node.id,
//       totalQuantity: edge.node.totalQuantity,
//       sku: edge.node.sku
//     }));

//     return {
//       orderId: order.id,
//       orderName: order.name,
//       fulfillmentOrderId: fulfillmentOrder.id,
//       fulfillmentOrderLineItems
//     };

//   } catch (error) {
//     console.error(`[getOrderByName] Error looking up order ${orderName}:`, error);
//     throw error;
//   }
// };
