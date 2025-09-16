import { unauthenticated } from "../../shopify.server";

export const setInventoryQuantities = async (
  inventoryUpdates: Array<{
    inventoryItemId: string;
    locationId: string;
    quantity: number;
  }>,
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

  // First, check which items are not tracked at the location
  const inventoryItemIds = inventoryUpdates.map(update => update.inventoryItemId);
  const locationId = inventoryUpdates[0]?.locationId;

  if (!locationId) {
    return {
      success: false,
      userErrors: [{ field: ['locationId'], message: 'No location ID provided' }]
    };
  }

  // Process inventory updates in batches to avoid hitting rate limits
  const batchSize = 10;
  for (let i = 0; i < inventoryUpdates.length; i += batchSize) {
    const batch = inventoryUpdates.slice(i, i + batchSize);

    try {
      // Convert updates to quantities format for inventorySetQuantities
      const quantities = batch.map(update => ({
        inventoryItemId: update.inventoryItemId,
        locationId: update.locationId,
        quantity: update.quantity // This will set the exact quantity
      }));

      console.log(`[setInventoryQuantities] Setting exact quantities for batch:`, quantities.map(q => `${q.inventoryItemId}: ${q.quantity}`).join(', '));

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
