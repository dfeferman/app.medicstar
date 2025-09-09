import prisma from "../../../db.server";
import { unauthenticated } from "../../../shopify.server";

// TODO: replace with value persisted in DB
const SHOP_DOMAIN = "medicstar-app-dev.myshopify.com";

const PRODUCT_CREATE_MUTATION = `
mutation ProductCreate($input: ProductCreateInput!) {
  productCreate(product: $input) {
    product {
      id
      title
      variants(first: 1) { nodes { id sku } }
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

type GraphqlExecutor = (
  query: string,
  options?: { variables?: Record<string, unknown> }
) => Promise<unknown>;

async function createShopifyProduct(
  graphql: GraphqlExecutor,
  product: {
    id: number;
    title: string;
    vendor: string;
    description: string | null;
    SKU: string;
    priceNetto: any;
    collection1: string;
    collection2: string | null;
    collection3: string | null;
    collection4: string | null;
  }
): Promise<string | null> {
  const tags: string[] = [
    product.collection1,
    product.collection2 ?? "",
    product.collection3 ?? "",
    product.collection4 ?? "",
  ].filter((t) => !!t && t.trim().length > 0) as string[];

  const variables = {
    input: {
      title: product.title,
      descriptionHtml: product.description ?? "",
      vendor: product.vendor,
      tags,
    },
  };

  const response = (await graphql(PRODUCT_CREATE_MUTATION, { variables })) as unknown;

  // Handle both Response-like and plain object results
  const result: any = typeof (response as any)?.json === "function" ? await (response as any).json() : response;

  const userErrors: Array<{ field?: string[]; message: string }>
    = result?.data?.productCreate?.userErrors ?? result?.productCreate?.userErrors ?? [];
  if (userErrors.length > 0) {
    console.error("[stage-2] productCreate errors:", userErrors);
    return null;
  }

  const createdProduct = result?.data?.productCreate?.product ?? result?.productCreate?.product;
  const createdId: string | undefined = createdProduct?.id;

  // Update the default variant with SKU and price via bulk update API
  const defaultVariantId: string | undefined = createdProduct?.variants?.nodes?.[0]?.id;
  if (defaultVariantId && createdId) {
    try {
      const locationId = process.env.SHOPIFY_LOCATION_ID;
      const variantResp = (await graphql(VARIANTS_BULK_UPDATE_MUTATION, {
        variables: {
          productId: createdId,
          variants: [
            {
              id: defaultVariantId,
              price: String(product.priceNetto),
              inventoryItem: {
                sku: product.SKU,
              },
              ...(locationId
                ? {
                    inventoryQuantities: [
                      {
                        locationId,
                        availableQuantity: 0,
                      },
                    ],
                  }
                : {}),
            },
          ],
        },
      })) as any;
      const variantResult: any = typeof variantResp?.json === "function" ? await variantResp.json() : variantResp;
      const vErrors: Array<{ field?: string[]; message: string }>
        = variantResult?.data?.productVariantsBulkUpdate?.userErrors ?? variantResult?.productVariantsBulkUpdate?.userErrors ?? [];
      if (vErrors.length > 0) {
        console.warn("[stage-2] productVariantsBulkUpdate errors:", vErrors);
      } else {
        console.log(`[stage-2] Set SKU and price for default variant ${defaultVariantId}`);
      }
    } catch (err) {
      console.warn(`[stage-2] Failed to set SKU/price for variant ${defaultVariantId}`, err);
    }
  }

  return createdId ?? null;
}

export async function createShopifyProducts(): Promise<void> {
  // const { graphql } = (await unauthenticated.admin(shop.domain)).admin;
  const { graphql } = (await unauthenticated.admin(SHOP_DOMAIN)).admin;

  const products = await prisma.product.findMany({
    where: { shopifyProductId: null },
    // orderBy: { id: "asc" },
    // take: 50,
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
    },
  });

  if (products.length === 0) {
    console.log("[stage-2] No products to sync.");
    return;
  }

  console.log(`[stage-2] Creating ${products.length} product(s) in Shopify for shop ${SHOP_DOMAIN}...`);

  for (const p of products) {
    try {
      const shopifyId = await createShopifyProduct(graphql, p);
      if (shopifyId) {
        await prisma.product.update({
          where: { id: p.id },
          data: { shopifyProductId: shopifyId, lastSyncedAt: new Date() },
        });
        console.log(`[stage-2] Created product in Shopify id=${shopifyId} (local id=${p.id})`);
      } else {
        console.warn(`[stage-2] Skipped local product id=${p.id} due to errors.`);
      }
    } catch (err) {
      console.error(`[stage-2] Failed to create product for local id=${p.id}`, err);
    }
  }
}

// Execute when run directly
createShopifyProducts()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });


