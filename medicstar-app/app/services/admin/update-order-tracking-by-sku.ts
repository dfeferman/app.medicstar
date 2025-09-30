import { SupportedCarrier } from "../../constants/deliveryService";
import { generateTrackingUrl } from "./helpers/generateTrackingUrl";
import { findOrderByName, type FulfillmentOrderLineItemEdge } from "./find-order-by-name";
import { createFulfillment, type FulfillmentInput } from "./create-order-fulfillment";

interface UpdateTrackingBySkuInput {
  shopDomain: string;
  orderName: string;
  carrier: SupportedCarrier;
  trackingNumber: string;
  allSkus: string[];
}



export const updateOrderTrackingBySku = async (input: UpdateTrackingBySkuInput) => {
  const { shopDomain, orderName, carrier, trackingNumber, allSkus } = input;

  try {
    const shopifyOrder = await findOrderByName(shopDomain, orderName);

    if (!shopifyOrder.fulfillmentOrders.edges.length) {
      throw new Error(`Order ${orderName} has no fulfillment orders`);
    }

    //TODO: If need more than one fulfillment order, we need to change this
    // Get the first fulfillment order (assuming single fulfillment)
    const targetFulfillmentOrder = shopifyOrder.fulfillmentOrders.edges[0].node;

    const matchingLineItemEdges = targetFulfillmentOrder.lineItems.edges.filter(
      (edge: FulfillmentOrderLineItemEdge) => allSkus.includes(edge.node.sku)
    );

    if (matchingLineItemEdges.length === 0) {
      throw new Error(`No line items found with SKUs ${allSkus.join(', ')} in order ${orderName}`);
    }

    const fulfillableLineItemEdges = matchingLineItemEdges.filter((edge: FulfillmentOrderLineItemEdge) => edge.node.remainingQuantity > 0);

    if (fulfillableLineItemEdges.length === 0) {
      return {
        success: true,
        skipped: true,
        reason: 'Already fulfilled',
        trackingNumber: trackingNumber
      };
    }

    const carrierTrackingUrl = generateTrackingUrl(carrier, trackingNumber);

    const fulfillmentInput: FulfillmentInput = {
      trackingInfo: {
        number: trackingNumber,
        company: carrier,
        url: carrierTrackingUrl
      },
      notifyCustomer: true,
      lineItemsByFulfillmentOrder: [
        {
          fulfillmentOrderId: targetFulfillmentOrder.id,
          fulfillmentOrderLineItems: fulfillableLineItemEdges.map((edge: FulfillmentOrderLineItemEdge) => ({
            id: edge.node.id,
            quantity: edge.node.remainingQuantity
          }))
        }
      ]
    };

    const createdFulfillment = await createFulfillment(
      shopDomain,
      fulfillmentInput,
      `Tracking number ${trackingNumber} updated for ${fulfillableLineItemEdges.length} line items in order ${orderName} via carrier ${carrier}`
    );

    return {
      success: true,
      trackingInfo: createdFulfillment.trackingInfo,
      trackingNumber: trackingNumber
    };

  } catch (error) {
    throw error;
  }
};
