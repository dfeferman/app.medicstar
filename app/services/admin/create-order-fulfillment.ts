import { unauthenticated } from "../../shopify.server";

interface FulfillmentInput {
  trackingInfo: {
    number: string;
    company: string;
    url: string;
  };
  notifyCustomer: boolean;
  lineItemsByFulfillmentOrder: Array<{
    fulfillmentOrderId: string;
    fulfillmentOrderLineItems: Array<{
      id: string;
      quantity: number;
    }>;
  }>;
}

interface CreatedFulfillment {
  id: string;
  status: string;
  trackingInfo: {
    number: string;
    company: string;
    url: string;
  };
}

interface FulfillmentCreateResponse {
  data?: {
    fulfillmentCreate?: {
      fulfillment?: CreatedFulfillment;
      userErrors?: Array<{
        field: string[];
        message: string;
      }>;
    };
  };
}

export async function createFulfillment(
  shopDomain: string,
  fulfillmentInput: FulfillmentInput,
  message?: string
): Promise<CreatedFulfillment> {
  const { admin: { graphql } } = await unauthenticated.admin(shopDomain);

  const fulfillmentMutation = `#graphql
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

  const fulfillmentCreationResponse = await graphql(fulfillmentMutation, {
    variables: {
      fulfillment: fulfillmentInput,
      message
    }
  });

  const fulfillmentCreationData: FulfillmentCreateResponse = await fulfillmentCreationResponse.json();

  if (fulfillmentCreationData.data?.fulfillmentCreate?.userErrors?.length) {
    const userErrors = fulfillmentCreationData.data.fulfillmentCreate.userErrors;
    throw new Error(`Fulfillment creation failed: ${userErrors.map((e) => e.message).join(', ')}`);
  }

  const createdFulfillment = fulfillmentCreationData.data?.fulfillmentCreate?.fulfillment;
  if (!createdFulfillment) {
    throw new Error('Failed to create fulfillment');
  }

  return createdFulfillment;
}

export type { FulfillmentInput, CreatedFulfillment };
