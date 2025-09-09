import prisma from "../../../db.server";
import { unauthenticated } from "../../../shopify.server";

const SHOP_DOMAIN = process.env.SHOP_DOMAIN;

const PRODUCT_CREATE_MUTATION = `
mutation ProductCreate($input: ProductCreateInput!) {
  productCreate(product: $input) {
    product {
      id
      title
      variants(first: 1) { nodes { id title inventoryItem { id } } }
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

const VARIANTS_BULK_CREATE_MUTATION = `
mutation VariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkCreate(productId: $productId, variants: $variants) {
    product { id }
    productVariants { id inventoryItem { id } }
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
    quantity: number;
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
  const defaultInventoryItemId: string | undefined = createdProduct?.variants?.nodes?.[0]?.inventoryItem?.id;
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
                tracked: true,
              },
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

  // Set quantity for the default variant using inventorySetQuantities
  try {
    const locationId = process.env.SHOPIFY_LOCATION_ID;
    if (locationId && defaultInventoryItemId) {
      const invResp = (await graphql(INVENTORY_SET_QUANTITIES, {
        variables: {
          input: {
            name: "available",
            reason: "correction",
            referenceDocumentUri: `app://sync/${product.id}`,
            ignoreCompareQuantity: true,
            quantities: [
              { inventoryItemId: defaultInventoryItemId, locationId, quantity: product.quantity },
            ],
          },
        },
      })) as any;
      const invRes: any = typeof invResp?.json === "function" ? await invResp.json() : invResp;
      const invErrors = invRes?.data?.inventorySetQuantities?.userErrors ?? [];
      if (invErrors.length > 0) {
        console.warn("[stage-2] inventorySetQuantities errors (single):", invErrors);
      }
    }
  } catch (err) {
    console.warn("[stage-2] Failed inventorySetQuantities for default variant", err);
  }

  return createdId ?? null;
}

export async function createShopifyProducts(): Promise<void> {
  const { graphql } = (await unauthenticated.admin(SHOP_DOMAIN!)).admin;

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
      variants: {
        select: {
          id: true,
          title: true, // variant value from "Varianten"
          optionName: true,
          SKU: true,
          priceNetto: true,
          quantity: true,
        },
      },
    },
  });

  if (products.length === 0) {
    console.log("[stage-2] No products to sync.");
    return;
  }

  console.log(`[stage-2] Creating ${products.length} product(s) in Shopify for shop ${SHOP_DOMAIN}...`);

  for (const p of products) {
    try {
      const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
      if (!hasVariants) {
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
        continue;
      }

      // Build tags and options
      const tags = [p.collection1, p.collection2, p.collection3, p.collection4]
        .filter((t) => !!t && String(t).trim().length > 0) as string[];
      const optionName = p.variants[0].optionName || "Variante";
      const variantValues = Array.from(new Set(p.variants.map((v) => v.title).filter(Boolean)));

      // 1) Create product with productOptions
      const productCreateVariables = {
        input: {
          title: p.title,
          descriptionHtml: p.description ?? "",
          vendor: p.vendor,
          tags,
          productOptions: [
            {
              name: optionName,
              values: variantValues.map((name) => ({ name })),
            },
          ],
        },
      };

      const createResp = (await graphql(PRODUCT_CREATE_MUTATION, { variables: productCreateVariables })) as any;
      const createResult: any = typeof createResp?.json === "function" ? await createResp.json() : createResp;
      const createErrors = createResult?.data?.productCreate?.userErrors ?? [];
      if (createErrors.length > 0) {
        console.error("[stage-2] productCreate errors:", createErrors);
        continue;
      }
      const createdProduct = createResult?.data?.productCreate?.product;
      const createdProductId: string | undefined = createdProduct?.id;
      const defaultVariantId: string | undefined = createdProduct?.variants?.nodes?.[0]?.id;
      if (!createdProductId) {
        console.warn(`[stage-2] No productId returned for local id=${p.id}`);
        continue;
      }

      // 2) Set SKU/price on default variant from the first DB variant
      const defaultDbVariant = p.variants[0];
      if (defaultVariantId && defaultDbVariant) {
        const locationId = process.env.SHOPIFY_LOCATION_ID;
        const updateResp = (await graphql(VARIANTS_BULK_UPDATE_MUTATION, {
          variables: {
            productId: createdProductId,
            variants: [
              {
                id: defaultVariantId,
                price: String(defaultDbVariant.priceNetto),
                inventoryItem: { sku: defaultDbVariant.SKU, tracked: true },
              },
            ],
          },
        })) as any;
        const updateResult: any = typeof updateResp?.json === "function" ? await updateResp.json() : updateResp;
        const updErrors = updateResult?.data?.productVariantsBulkUpdate?.userErrors ?? [];
        if (updErrors.length > 0) {
          console.warn("[stage-2] productVariantsBulkUpdate errors:", updErrors);
        }

        // Set quantity using inventorySetQuantities for default variant
        try {
          const defaultInvItemId = createdProduct?.variants?.nodes?.[0]?.inventoryItem?.id;
          if (locationId && defaultInvItemId) {
            const invResp = (await graphql(INVENTORY_SET_QUANTITIES, {
              variables: {
                input: {
                  name: "available",
                  reason: "correction",
                  referenceDocumentUri: `app://sync/${p.id}`,
                  ignoreCompareQuantity: true,
                  quantities: [
                    { inventoryItemId: defaultInvItemId, locationId, quantity: defaultDbVariant.quantity },
                  ],
                },
              },
            })) as any;
            const invRes: any = typeof invResp?.json === "function" ? await invResp.json() : invResp;
            const invErrors = invRes?.data?.inventorySetQuantities?.userErrors ?? [];
            if (invErrors.length > 0) {
              console.warn("[stage-2] inventorySetQuantities errors (default):", invErrors);
            }
          }
        } catch (err) {
          console.warn("[stage-2] Failed inventorySetQuantities for default variant", err);
        }
      }

      // 3) Create the remaining variants
      const rest = p.variants.slice(1);
      if (rest.length > 0) {
        const variantsPayload = rest.map((v) => ({
          optionValues: [{ name: v.title, optionName }],
          price: String(v.priceNetto),
          inventoryItem: { sku: v.SKU, tracked: true },
        }));

        const createVarResp = (await graphql(VARIANTS_BULK_CREATE_MUTATION, {
          variables: { productId: createdProductId, variants: variantsPayload },
        })) as any;
        const createVarResult: any = typeof createVarResp?.json === "function" ? await createVarResp.json() : createVarResp;
        const varErrors = createVarResult?.data?.productVariantsBulkCreate?.userErrors ?? [];
        if (varErrors.length > 0) {
          console.warn("[stage-2] productVariantsBulkCreate errors:", varErrors);
        }

        // Set quantities for newly created variants via inventorySetQuantities (bulk)
        try {
          const locationId2 = process.env.SHOPIFY_LOCATION_ID;
          if (locationId2) {
            const createdVariants = createVarResult?.data?.productVariantsBulkCreate?.productVariants ?? [];
            const quantities = createdVariants
              .map((cv: any, idx: number) => {
                const invId = cv?.inventoryItem?.id;
                const dbVariant = rest[idx];
                if (!invId || !dbVariant) return null;
                return { inventoryItemId: invId, locationId: locationId2, quantity: dbVariant.quantity };
              })
              .filter(Boolean);
            if (quantities.length > 0) {
              const invResp = (await graphql(INVENTORY_SET_QUANTITIES, {
                variables: {
                  input: {
                    name: "available",
                    reason: "correction",
                    referenceDocumentUri: `app://sync/${p.id}`,
                    ignoreCompareQuantity: true,
                    quantities,
                  },
                },
              })) as any;
              const invRes: any = typeof invResp?.json === "function" ? await invResp.json() : invResp;
              const invErrors = invRes?.data?.inventorySetQuantities?.userErrors ?? [];
              if (invErrors.length > 0) {
                console.warn("[stage-2] inventorySetQuantities errors (bulk)", invErrors);
              }
            }
          }
        } catch (err) {
          console.warn("[stage-2] Failed inventorySetQuantities for created variants", err);
        }
      }

      await prisma.product.update({
        where: { id: p.id },
        data: { shopifyProductId: createdProductId, lastSyncedAt: new Date() },
      });
      console.log(`[stage-2] Created product with variants in Shopify id=${createdProductId} (local id=${p.id})`);
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


