import { unauthenticated } from "../../shopify.server";

type InventoryItem = {
  id: string;
}

type ProductItem = {
  id: string;
}
interface ShopifyVariant {
  id: string;
  inventoryQuantity: number;
  price: string;
  sku: string;
  inventoryItem: InventoryItem;
  product: ProductItem;
}

export const getProductVariantsBySku = async (
  skus: string[],
  shopDomain: string
): Promise<ShopifyVariant[]> => {
  const {
    admin: { graphql },
  } = await unauthenticated.admin(shopDomain);

  const skuQuery = skus.map(sku => `sku:${sku}`).join(" OR ");

  const query = `#graphql
    query getProductVariants($query: String!) {
      productVariants(first: 250, query: $query) {
        nodes {
          id
          inventoryQuantity
          price
          sku
          inventoryItem {
            id
          }
          product {
            id
          }
        }
      }
    }`;

  const response = await graphql(query, {
    variables: {
      query: skuQuery,
    },
  });

  const responseJson = await response.json();

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${JSON.stringify(responseJson)}`);
  }

  return responseJson.data?.productVariants?.nodes || [];
};
