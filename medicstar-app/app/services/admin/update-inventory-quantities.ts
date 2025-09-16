import { unauthenticated } from "../../shopify.server";

const SHOP_DOMAIN = process.env.SHOP_DOMAIN!;

export const updateInventoryQuantities = async (
  inventoryUpdates: Array<{
    inventoryItemId: string;
    locationId: string;
    quantity: number;
  }>
): Promise<{ success: boolean; userErrors: any[] }> => {
  const {
    admin: { graphql },
  } = await unauthenticated.admin(SHOP_DOMAIN);

  const mutation = `#graphql
    mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        inventoryAdjustmentGroup {
          id
          createdAt
          reason
        }
        userErrors {
          field
          message
        }
      }
    }`;

  const quantities = inventoryUpdates.map(update => ({
    inventoryItemId: update.inventoryItemId,
    locationId: update.locationId,
    quantity: update.quantity,
    compareQuantity: 0
  }));

  const response = await graphql(mutation, {
    variables: {
      input: {
        name: "available",
        reason: "correction",
        referenceDocumentUri: "app://medicstar-sync",
        quantities
      }
    }
  });

  const responseJson = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to update inventory: ${JSON.stringify(responseJson)}`);
  }

  return {
    success: responseJson.data.inventorySetQuantities.inventoryAdjustmentGroup !== null,
    userErrors: responseJson.data.inventorySetQuantities.userErrors || []
  };
};
