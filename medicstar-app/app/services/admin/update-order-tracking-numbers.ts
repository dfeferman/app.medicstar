// import { unauthenticated } from "../../shopify.server";
// import { getOrderByName } from "./get-order-by-name";

// interface UpdateTrackingInput {
//   shopDomain: string;
//   orderName: string;
//   carrier: 'DPD' | 'DHL';
//   trackingNumbers: string[];
// }

// // Map carrier names to tracking company names (only DPD and DHL supported)
// const mapCarrierToCompany = (carrier: string): string => {
//   const carrierMap: Record<string, string> = {
//     'DPD': 'DPD',
//     'DHL': 'DHL'
//   };

//   const mappedCarrier = carrierMap[carrier.toUpperCase()];
//   if (!mappedCarrier) {
//     throw new Error(`Unsupported carrier: ${carrier}. Only DPD and DHL are supported.`);
//   }

//   return mappedCarrier;
// };

// export const updateOrderTrackingNumbers = async (input: UpdateTrackingInput) => {
//   const { shopDomain, orderName, carrier, trackingNumbers } = input;

//   console.log(`[updateOrderTrackingNumbers] Updating order ${orderName} with ${trackingNumbers.length} tracking numbers for carrier ${carrier}`);

//   try {
//     const { admin: { graphql } } = await unauthenticated.admin(shopDomain);

//     // Get order information using the separate service
//     const orderInfo = await getOrderByName(shopDomain, orderName);

//     // Create fulfillment with tracking information
//     const fulfillmentCreateMutation = `#graphql
//       mutation fulfillmentCreate($fulfillment: FulfillmentInput!, $message: String) {
//         fulfillmentCreate(fulfillment: $fulfillment, message: $message) {
//           fulfillment {
//             id
//             status
//             trackingInfo {
//               number
//               company
//               url
//             }
//           }
//           userErrors {
//             field
//             message
//           }
//         }
//       }
//     `;

//     const trackingCompany = mapCarrierToCompany(carrier);
//     const primaryTrackingNumber = trackingNumbers[0];

//     const fulfillmentInput = {
//       trackingInfo: {
//         number: primaryTrackingNumber,
//         company: trackingCompany,
//         numbers: trackingNumbers, // All tracking numbers
//         urls: trackingNumbers.map(num => generateTrackingUrl(carrier, num))
//       },
//       notifyCustomer: true,
//       lineItemsByFulfillmentOrder: [
//         {
//           fulfillmentOrderId: orderInfo.fulfillmentOrderId,
//           fulfillmentOrderLineItems: orderInfo.fulfillmentOrderLineItems
//         }
//       ]
//     };

//     console.log(`[updateOrderTrackingNumbers] Creating fulfillment with tracking info:`, {
//       company: trackingCompany,
//       primaryNumber: primaryTrackingNumber,
//       allNumbers: trackingNumbers,
//       lineItemsCount: orderInfo.fulfillmentOrderLineItems.length
//     });

//     const fulfillmentResponse = await graphql(fulfillmentCreateMutation, {
//       variables: {
//         fulfillment: fulfillmentInput,
//         message: `Tracking numbers updated for order ${orderName} via carrier ${carrier}`
//       }
//     });

//     const fulfillmentData = await fulfillmentResponse.json();

//     if (fulfillmentData.data?.fulfillmentCreate?.userErrors?.length) {
//       const errors = fulfillmentData.data.fulfillmentCreate.userErrors;
//       throw new Error(`Fulfillment creation failed: ${errors.map((e: any) => e.message).join(', ')}`);
//     }

//     const createdFulfillment = fulfillmentData.data?.fulfillmentCreate?.fulfillment;
//     if (!createdFulfillment) {
//       throw new Error('Failed to create fulfillment');
//     }

//     console.log(`[updateOrderTrackingNumbers] ✅ Successfully created fulfillment ${createdFulfillment.id} for order ${orderName}`);

//     return {
//       success: true,
//       fulfillmentId: createdFulfillment.id,
//       trackingInfo: createdFulfillment.trackingInfo
//     };

//   } catch (error) {
//     console.error(`[updateOrderTrackingNumbers] ❌ Error updating tracking for order ${orderName}:`, error);
//     throw error;
//   }
// };

// // Generate tracking URL based on carrier and tracking number (only DPD and DHL supported)
// const generateTrackingUrl = (carrier: string, trackingNumber: string): string => {
//   const urlMap: Record<string, string> = {
//     'DPD': `https://tracking.dpd.de/status/en_US/parcel/${trackingNumber}`,
//     'DHL': `https://www.dhl.com/de-en/home/tracking/tracking-parcel.html?submit=1&tracking-id=${trackingNumber}`
//   };

//   const trackingUrl = urlMap[carrier.toUpperCase()];
//   if (!trackingUrl) {
//     throw new Error(`Unsupported carrier for tracking URL: ${carrier}. Only DPD and DHL are supported.`);
//   }

//   return trackingUrl;
// };
