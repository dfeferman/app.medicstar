import { unauthenticated } from "../../shopify.server";

interface InventoryUpdateData {
  inventoryItemId: string;
  locationId: string;
  quantity: number;
}

const BATCH_SIZE = 10;

export const setInventoryQuantities = async (
  inventoryUpdates: InventoryUpdateData[],
  shopDomain: string
): Promise<{ success: boolean; userErrors: any[] }> => {
  const {
    admin: { graphql },
  } = await unauthenticated.admin(shopDomain);

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

  const allUserErrors: any[] = [];
  let successCount = 0;

  const locationId = inventoryUpdates[0]?.locationId;

  if (!locationId) {
    return {
      success: false,
      userErrors: [{ field: ['locationId'], message: 'No location ID provided' }]
    };
  }

  for (let i = 0; i < inventoryUpdates.length; i += BATCH_SIZE) {
    const batch = inventoryUpdates.slice(i, i + BATCH_SIZE);

    try {
      const quantities = batch.map(update => ({
        inventoryItemId: update.inventoryItemId,
        locationId: update.locationId,
        quantity: update.quantity
      }));

      const response = await graphql(mutation, {
        variables: {
          input: {
            name: "available",
            reason: "correction",
            referenceDocumentUri: "app://medicstar-sync",
            quantities: quantities,
            ignoreCompareQuantity: true
          }
        }
      });

      const responseJson = await response.json();

      if (!response.ok) {
        allUserErrors.push({
          field: ['inventorySetQuantities'],
          message: `Failed to update inventory batch: ${JSON.stringify(responseJson)}`
        });
      } else if (responseJson.data.inventorySetQuantities.userErrors.length > 0) {
        allUserErrors.push(...responseJson.data.inventorySetQuantities.userErrors);
      } else {
        successCount += batch.length;
      }
    } catch (error) {
      allUserErrors.push({
        field: ['inventorySetQuantities'],
        message: `Error updating inventory batch: ${error}`
      });
    }
  }

  return {
    success: successCount === inventoryUpdates.length && allUserErrors.length === 0,
    userErrors: allUserErrors
  };
};
