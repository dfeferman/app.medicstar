import prisma from "../../../db.server";
import { unauthenticated } from "../../../shopify.server";

const SHOP_DOMAIN = process.env.SHOP_DOMAIN;

const PRODUCT_UPDATE_MUTATION = `
mutation ProductUpdate($input: ProductUpdateInput!) {
  productUpdate(product: $input) {
    product {
      id
      title
      descriptionHtml
      vendor
      tags
    }
    userErrors { field message }
  }
}`;

const VARIANTS_BULK_UPDATE_MUTATION = `
mutation VariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    product { id }
    userErrors { field message }
  }
}`;

const INVENTORY_SET_QUANTITIES = `
mutation InventorySetQuantities($input: InventorySetQuantitiesInput!) {
  inventorySetQuantities(input: $input) {
    inventoryAdjustmentGroup { createdAt }
    userErrors { field message }
  }
}`;

const PRODUCT_QUERY = `
query Product($id: ID!) {
  product(id: $id) {
    id
    title
    descriptionHtml
    vendor
    tags
    variants(first: 50) {
      nodes {
        id
        title
        price
        inventoryItem {
          id
          sku
        }
      }
    }
  }
}`;

type GraphqlExecutor = (
  query: string,
  options?: { variables?: Record<string, unknown> }
) => Promise<unknown>;

async function getShopifyProductData(graphql: GraphqlExecutor, shopifyProductId: string) {
  const response = (await graphql(PRODUCT_QUERY, {
    variables: { id: shopifyProductId }
  })) as unknown;

  const result: any = typeof (response as any)?.json === "function" ? await (response as any).json() : response;
  return result?.data?.product ?? result?.product;
}

async function updateShopifyProduct(
  graphql: GraphqlExecutor,
  shopifyProductId: string,
  product: {
    id: number;
    title: string;
    vendor: string;
    description: string | null;
    collection1: string;
    collection2: string | null;
    collection3: string | null;
    collection4: string | null;
  }
): Promise<boolean> {
  const tags: string[] = [
    product.collection1,
    product.collection2 ?? "",
    product.collection3 ?? "",
    product.collection4 ?? "",
  ].filter((t) => !!t && t.trim().length > 0) as string[];

  const variables = {
    input: {
      id: shopifyProductId,
      title: product.title,
      descriptionHtml: product.description ?? "",
      vendor: product.vendor,
      tags,
    },
  };

  const response = (await graphql(PRODUCT_UPDATE_MUTATION, { variables })) as unknown;
  const result: any = typeof (response as any)?.json === "function" ? await (response as any).json() : response;

  const userErrors: Array<{ field?: string[]; message: string }>
    = result?.data?.productUpdate?.userErrors ?? result?.productUpdate?.userErrors ?? [];

  if (userErrors.length > 0) {
    console.error("[stage-3] productUpdate errors:", userErrors);
    return false;
  }

  console.log(`[stage-3] Updated product in Shopify id=${shopifyProductId}`);
  return true;
}

async function updateShopifyVariant(
  graphql: GraphqlExecutor,
  productId: string,
  variant: {
    id: string;
    title: string;
    priceNetto: any;
    quantity: number;
    SKU: string;
  }
): Promise<boolean> {
  const variables = {
    productId,
    variants: [
      {
        id: variant.id,
        title: variant.title,
        price: String(variant.priceNetto),
        inventoryItem: {
          sku: variant.SKU,
          tracked: true,
        },
      },
    ],
  };

  const response = (await graphql(VARIANTS_BULK_UPDATE_MUTATION, { variables })) as unknown;
  const result: any = typeof (response as any)?.json === "function" ? await (response as any).json() : response;

  const userErrors: Array<{ field?: string[]; message: string }>
    = result?.data?.productVariantsBulkUpdate?.userErrors ?? result?.productVariantsBulkUpdate?.userErrors ?? [];

  if (userErrors.length > 0) {
    console.error("[stage-3] productVariantsBulkUpdate errors:", userErrors);
    return false;
  }

  console.log(`[stage-3] Updated variant in Shopify id=${variant.id}`);
  return true;
}

async function updateInventoryQuantity(
  graphql: GraphqlExecutor,
  inventoryItemId: string,
  quantity: number,
  productId: number
): Promise<boolean> {
  const locationId = process.env.SHOPIFY_LOCATION_ID;
  if (!locationId) {
    console.warn("[stage-3] No SHOPIFY_LOCATION_ID configured");
    return false;
  }

  const variables = {
    input: {
      name: "available",
      reason: "correction",
      referenceDocumentUri: `app://sync/${productId}`,
      ignoreCompareQuantity: true,
      quantities: [
        { inventoryItemId, locationId, quantity },
      ],
    },
  };

  const response = (await graphql(INVENTORY_SET_QUANTITIES, { variables })) as unknown;
  const result: any = typeof (response as any)?.json === "function" ? await (response as any).json() : response;

  const userErrors = result?.data?.inventorySetQuantities?.userErrors ?? [];
  if (userErrors.length > 0) {
    console.warn("[stage-3] inventorySetQuantities errors:", userErrors);
    return false;
  }

  console.log(`[stage-3] Updated inventory quantity for item ${inventoryItemId} to ${quantity}`);
  return true;
}

function hasProductChanges(
  shopifyProduct: any,
  dbProduct: {
    title: string;
    vendor: string;
    description: string | null;
    collection1: string;
    collection2: string | null;
    collection3: string | null;
    collection4: string | null;
  }
): { hasChanges: boolean; changes: string[] } {
  const changes: string[] = [];

  const dbTags = [
    dbProduct.collection1,
    dbProduct.collection2 ?? "",
    dbProduct.collection3 ?? "",
    dbProduct.collection4 ?? "",
  ].filter((t) => !!t && t.trim().length > 0);

  const shopifyTags = shopifyProduct?.tags || [];
  const tagsEqual = JSON.stringify(dbTags.sort()) === JSON.stringify(shopifyTags.sort());

  if (shopifyProduct?.title !== dbProduct.title) {
    changes.push(`title: "${shopifyProduct?.title}" → "${dbProduct.title}"`);
  }
  if (shopifyProduct?.vendor !== dbProduct.vendor) {
    changes.push(`vendor: "${shopifyProduct?.vendor}" → "${dbProduct.vendor}"`);
  }
  if (shopifyProduct?.descriptionHtml !== (dbProduct.description ?? "")) {
    changes.push(`description: "${shopifyProduct?.descriptionHtml}" → "${dbProduct.description ?? ""}"`);
  }
  if (!tagsEqual) {
    changes.push(`tags: [${shopifyTags.join(", ")}] → [${dbTags.join(", ")}]`);
  }

  return { hasChanges: changes.length > 0, changes };
}

function hasVariantChanges(
  shopifyVariant: any,
  dbVariant: {
    title: string;
    priceNetto: any;
    SKU: string;
  }
): { hasChanges: boolean; changes: string[] } {
  const changes: string[] = [];

  if (shopifyVariant?.title !== dbVariant.title) {
    changes.push(`title: "${shopifyVariant?.title}" → "${dbVariant.title}"`);
  }
  if (shopifyVariant?.price !== String(dbVariant.priceNetto)) {
    changes.push(`price: "${shopifyVariant?.price}" → "${String(dbVariant.priceNetto)}"`);
  }
  if (shopifyVariant?.inventoryItem?.sku !== dbVariant.SKU) {
    changes.push(`sku: "${shopifyVariant?.inventoryItem?.sku}" → "${dbVariant.SKU}"`);
  }

  return { hasChanges: changes.length > 0, changes };
}

export async function updateShopifyProducts(): Promise<void> {
  const { graphql } = (await unauthenticated.admin(SHOP_DOMAIN!)).admin;

  // Get all products that have been synced to Shopify and have been updated since last sync
  const products = await prisma.product.findMany({
    where: {
      shopifyProductId: { not: null },
      // Only update products that have been modified since last Shopify sync
      lastSyncedAt: { lt: new Date() }
    },
    select: {
      id: true,
      title: true,
      vendor: true,
      description: true,
      SKU: true,
      priceNetto: true,
      quantity: true,
      collection1: true,
      collection2: true,
      collection3: true,
      collection4: true,
      shopifyProductId: true,
      lastSyncedAt: true,
      variants: {
        select: {
          id: true,
          title: true,
          optionName: true,
          SKU: true,
          priceNetto: true,
          quantity: true,
          shopifyVariantId: true,
        },
      },
    },
  });

  if (products.length === 0) {
    console.log("[stage-3] No products to update.");
    return;
  }

  console.log(`[stage-3] Updating ${products.length} product(s) in Shopify for shop ${SHOP_DOMAIN}...`);

  for (const product of products) {
    try {
      if (!product.shopifyProductId) {
        console.warn(`[stage-3] Product ${product.id} has no shopifyProductId, skipping`);
        continue;
      }

      // Get current Shopify product data
      const shopifyProduct = await getShopifyProductData(graphql, product.shopifyProductId);
      if (!shopifyProduct) {
        console.warn(`[stage-3] Could not fetch Shopify product ${product.shopifyProductId}, skipping`);
        continue;
      }

      // Check if product needs updates
      const productChanges = hasProductChanges(shopifyProduct, product);
      if (productChanges.hasChanges) {
        console.log(`[stage-3] Changes detected for product ${product.shopifyProductId}:`);
        productChanges.changes.forEach(change => console.log(`  - ${change}`));

        const updated = await updateShopifyProduct(graphql, product.shopifyProductId, product);
        if (!updated) {
          console.error(`[stage-3] Failed to update product ${product.shopifyProductId}`);
          continue;
        }
      } else {
        console.log(`[stage-3] Product ${product.shopifyProductId} unchanged, skipping product update`);
      }

      // Update variants
      const shopifyVariants = shopifyProduct.variants?.nodes || [];
      for (const dbVariant of product.variants) {
        if (!dbVariant.shopifyVariantId) {
          console.warn(`[stage-3] Variant ${dbVariant.id} has no shopifyVariantId, skipping`);
          continue;
        }

        const shopifyVariant = shopifyVariants.find((v: any) => v.id === dbVariant.shopifyVariantId);
        if (!shopifyVariant) {
          console.warn(`[stage-3] Could not find Shopify variant ${dbVariant.shopifyVariantId}, skipping`);
          continue;
        }

        // Check if variant needs updates
        const variantChanges = hasVariantChanges(shopifyVariant, dbVariant);
        if (variantChanges.hasChanges) {
          console.log(`[stage-3] Changes detected for variant ${dbVariant.shopifyVariantId}:`);
          variantChanges.changes.forEach(change => console.log(`  - ${change}`));

          const updated = await updateShopifyVariant(graphql, product.shopifyProductId, {
            id: dbVariant.shopifyVariantId,
            title: dbVariant.title,
            priceNetto: dbVariant.priceNetto,
            quantity: dbVariant.quantity,
            SKU: dbVariant.SKU,
          });

          if (!updated) {
            console.error(`[stage-3] Failed to update variant ${dbVariant.shopifyVariantId}`);
            continue;
          }
        } else {
          console.log(`[stage-3] Variant ${dbVariant.shopifyVariantId} unchanged, skipping variant update`);
        }

        // Update inventory quantity if needed
        const currentQuantity = shopifyVariant.inventoryItem?.quantity || 0;
        if (currentQuantity !== dbVariant.quantity) {
          console.log(`[stage-3] Quantity change detected for variant ${dbVariant.shopifyVariantId}: ${currentQuantity} → ${dbVariant.quantity}`);

          const inventoryUpdated = await updateInventoryQuantity(
            graphql,
            shopifyVariant.inventoryItem.id,
            dbVariant.quantity,
            product.id
          );

          if (!inventoryUpdated) {
            console.error(`[stage-3] Failed to update inventory for variant ${dbVariant.shopifyVariantId}`);
          }
        }
      }

      // Update lastSyncedAt timestamp
      await prisma.product.update({
        where: { id: product.id },
        data: { lastSyncedAt: new Date() },
      });

      console.log(`[stage-3] Completed update for product ${product.shopifyProductId} (local id=${product.id})`);
    } catch (err) {
      console.error(`[stage-3] Failed to update product for local id=${product.id}`, err);
    }
  }
}

// Execute when run directly
updateShopifyProducts()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
