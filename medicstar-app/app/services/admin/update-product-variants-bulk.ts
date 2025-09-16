import { unauthenticated } from "../../shopify.server";

interface ShopifyVariant {
  id: string;
  inventoryQuantity: number;
  price: string;
  sku: string;
  inventoryItem: {
    id: string;
  };
  product: {
    id: string;
  };
}

interface BulkUpdateResult {
  productVariants: ShopifyVariant[];
  userErrors: Array<{
    field: string[];
    message: string;
  }>;
}

export const updateProductVariantsBulk = async (
  variants: Array<{
    id: string;
    productId: string;
    price?: string;
  }>,
  shopDomain: string
): Promise<BulkUpdateResult> => {
  const {
    admin: { graphql },
  } = await unauthenticated.admin(shopDomain);

  // Group variants by productId
  const variantsByProduct = new Map<string, Array<{
    id: string;
    price?: string;
  }>>();

  variants.forEach(variant => {
    if (!variantsByProduct.has(variant.productId)) {
      variantsByProduct.set(variant.productId, []);
    }
    variantsByProduct.get(variant.productId)!.push({
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
  const allErrors: Array<{ field: string[]; message: string }> = [];

  // Process each product separately
  for (const [productId, productVariants] of variantsByProduct) {
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
