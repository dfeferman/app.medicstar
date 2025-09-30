import { unauthenticated } from "../../shopify.server";
interface InventoryItem {
  id: string;
}
interface Product {
  id: string;
}
interface ShopifyVariant {
  id: string;
  inventoryQuantity: number;
  price: string;
  sku: string;
  inventoryItem: InventoryItem;
  product: Product;
}
interface UserError {
  field: string[];
  message: string;
}

interface BulkUpdateResult {
  productVariants: ShopifyVariant[];
  userErrors: UserError[];
}
interface PriceUpdateData {
  id: string;
  productId: string;
  price?: string;
}

interface VariantUpdateData {
  id: string;
  price?: string;
}

export const updateProductVariantsBulk = async (
  variants: PriceUpdateData[],
  shopDomain: string
): Promise<BulkUpdateResult> => {
  const {
    admin: { graphql },
  } = await unauthenticated.admin(shopDomain);

  const variantsGroupedByProductIdMap = new Map<string, VariantUpdateData[]>();

  variants.forEach(variant => {
    if (!variantsGroupedByProductIdMap.has(variant.productId)) {
      variantsGroupedByProductIdMap.set(variant.productId, []);
    }
    variantsGroupedByProductIdMap.get(variant.productId)!.push({
      id: variant.id,
      price: variant.price
    });
  });

  const mutation = `#graphql
    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          inventoryQuantity
          price
          sku
          product {
            id
          }
        }
        userErrors {
          field
          message
        }
      }
    }`;

  const allResults: ShopifyVariant[] = [];
  const allErrors: UserError[] = [];

  for (const [productId, productVariants] of variantsGroupedByProductIdMap) {
    const response = await graphql(mutation, {
      variables: {
        productId: productId,
        variants: productVariants,
      },
    });

    const responseJson = await response.json();

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${JSON.stringify(responseJson)}`);
    }

    const result = responseJson.data?.productVariantsBulkUpdate;
    if (result) {
      if (result.productVariants) {
        allResults.push(...result.productVariants);
      }
      if (result.userErrors) {
        allErrors.push(...result.userErrors);
      }
    }
  }

  return { productVariants: allResults, userErrors: allErrors };
};
