import { unauthenticated } from "../../shopify.server";

interface UpdateTrackingBySkuInput {
  shopDomain: string;
  orderName: string;
  carrier: 'DPD' | 'DHL';
  sku: string;
  trackingNumber: string;
  allSkus?: string[]; // Optional: all SKUs to fulfill with this tracking number
}

// Map carrier names to tracking company names (only DPD and DHL supported)
const mapCarrierToCompany = (carrier: string): string => {
  const carrierMap: Record<string, string> = {
    'DPD': 'DPD',
    'DHL': 'DHL'
  };

  const mappedCarrier = carrierMap[carrier.toUpperCase()];
  if (!mappedCarrier) {
    throw new Error(`Unsupported carrier: ${carrier}. Only DPD and DHL are supported.`);
  }

  return mappedCarrier;
};

// Generate tracking URL based on carrier and tracking number (only DPD and DHL supported)
const generateTrackingUrl = (carrier: string, trackingNumber: string): string => {
  const urlMap: Record<string, string> = {
    'DPD': `https://tracking.dpd.de/status/en_US/parcel/${trackingNumber}`,
    'DHL': `https://www.dhl.com/de-en/home/tracking/tracking-parcel.html?submit=1&tracking-id=${trackingNumber}`
  };

  const trackingUrl = urlMap[carrier.toUpperCase()];
  if (!trackingUrl) {
    throw new Error(`Unsupported carrier for tracking URL: ${carrier}. Only DPD and DHL are supported.`);
  }

  return trackingUrl;
};

export const updateOrderTrackingBySku = async (input: UpdateTrackingBySkuInput) => {
  const { shopDomain, orderName, carrier, sku, trackingNumber, allSkus } = input;

  console.log(`[updateOrderTrackingBySku] Updating order ${orderName}, SKU ${sku} with tracking number ${trackingNumber} for carrier ${carrier}`);

  try {
    const { admin: { graphql } } = await unauthenticated.admin(shopDomain);

    // First, find the order and get fulfillment order line items
    const findOrderQuery = `#graphql
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

    const findOrderResponse = await graphql(findOrderQuery, {
      variables: { query: `name:${orderName}` }
    });

    const findOrderData = await findOrderResponse.json();

    if (!findOrderData.data?.orders?.edges?.length) {
      throw new Error(`Order ${orderName} not found`);
    }

    const order = findOrderData.data.orders.edges[0].node;
    console.log(`[updateOrderTrackingBySku] Found order ${order.id} (${order.name})`);

    if (!order.fulfillmentOrders.edges.length) {
      throw new Error(`Order ${orderName} has no fulfillment orders`);
    }

    // Get the first fulfillment order (assuming single fulfillment)
    const fulfillmentOrder = order.fulfillmentOrders.edges[0].node;
    console.log(`[updateOrderTrackingBySku] Using fulfillment order ${fulfillmentOrder.id}`);

    // Find all line items to fulfill (either specific SKU or all SKUs)
    const skusToFulfill = allSkus || [sku];
    const matchingLineItems = fulfillmentOrder.lineItems.edges.filter(
      (edge: any) => skusToFulfill.includes(edge.node.sku)
    );

    if (matchingLineItems.length === 0) {
      throw new Error(`No line items found with SKUs ${skusToFulfill.join(', ')} in order ${orderName}`);
    }

    console.log(`[updateOrderTrackingBySku] Found ${matchingLineItems.length} matching line items:`,
      matchingLineItems.map((edge: any) => ({
        sku: edge.node.sku,
        lineItemId: edge.node.id,
        totalQuantity: edge.node.totalQuantity,
        remainingQuantity: edge.node.remainingQuantity
      }))
    );

    // Check if any line items can be fulfilled
    const fulfillableItems = matchingLineItems.filter((edge: any) => edge.node.remainingQuantity > 0);

    if (fulfillableItems.length === 0) {
      console.log(`[updateOrderTrackingBySku] ⚠️ All line items in order ${orderName} are already fulfilled. Skipping.`);
      return {
        success: true,
        skipped: true,
        reason: 'Already fulfilled',
        sku: sku,
        trackingNumber: trackingNumber
      };
    }

    // Create fulfillment with tracking information for the specific line item
    const fulfillmentCreateMutation = `#graphql
      mutation fulfillmentCreate($fulfillment: FulfillmentInput!, $message: String) {
        fulfillmentCreate(fulfillment: $fulfillment, message: $message) {
          fulfillment {
            id
            status
            trackingInfo {
              number
              company
              url
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const trackingCompany = mapCarrierToCompany(carrier);
    const trackingUrl = generateTrackingUrl(carrier, trackingNumber);

    const fulfillmentInput = {
      trackingInfo: {
        number: trackingNumber,
        company: trackingCompany,
        url: trackingUrl
      },
      notifyCustomer: true,
      lineItemsByFulfillmentOrder: [
        {
          fulfillmentOrderId: fulfillmentOrder.id,
          fulfillmentOrderLineItems: fulfillableItems.map((edge: any) => ({
            id: edge.node.id,
            quantity: edge.node.remainingQuantity
          }))
        }
      ]
    };

    console.log(`[updateOrderTrackingBySku] Creating fulfillment for ${fulfillableItems.length} line items with tracking info:`, {
      company: trackingCompany,
      trackingNumber: trackingNumber,
      trackingUrl: trackingUrl,
      lineItemCount: fulfillableItems.length,
      totalQuantity: fulfillableItems.reduce((sum: number, edge: any) => sum + edge.node.remainingQuantity, 0)
    });

    const fulfillmentResponse = await graphql(fulfillmentCreateMutation, {
      variables: {
        fulfillment: fulfillmentInput,
        message: `Tracking number ${trackingNumber} updated for ${fulfillableItems.length} line items in order ${orderName} via carrier ${carrier}`
      }
    });

    const fulfillmentData = await fulfillmentResponse.json();

    if (fulfillmentData.data?.fulfillmentCreate?.userErrors?.length) {
      const errors = fulfillmentData.data.fulfillmentCreate.userErrors;
      throw new Error(`Fulfillment creation failed: ${errors.map((e: any) => e.message).join(', ')}`);
    }

    const createdFulfillment = fulfillmentData.data?.fulfillmentCreate?.fulfillment;
    if (!createdFulfillment) {
      throw new Error('Failed to create fulfillment');
    }

    console.log(`[updateOrderTrackingBySku] ✅ Successfully created fulfillment ${createdFulfillment.id} for ${fulfillableItems.length} line items in order ${orderName}`);

    return {
      success: true,
      fulfillmentId: createdFulfillment.id,
      trackingInfo: createdFulfillment.trackingInfo,
      sku: sku,
      trackingNumber: trackingNumber,
      lineItemsFulfilled: fulfillableItems.length
    };

  } catch (error) {
    console.error(`[updateOrderTrackingBySku] ❌ Error updating tracking for order ${orderName}:`, error);
    throw error;
  }
};
