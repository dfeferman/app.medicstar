import prisma from "../../../../db.server";

export const groupVariantsCreate = async () => {
  // Get variants with empty shopifyVariantId, grouped by their parent product
  const variantsToCreate = await prisma.productVariant.findMany({
    where: {
      shopifyVariantId: null,
      product: {
        shopifyProductId: { not: null } // Only variants whose parent product has a Shopify ID
      }
    },
    select: {
      id: true,
      title: true,
      optionName: true,
      SKU: true,
      priceNetto: true,
      quantity: true,
      productId: true,
      product: {
        select: {
          id: true,
          shopifyProductId: true,
          title: true,
        },
      },
    },
    orderBy: {
      productId: 'asc', // Group by product
    },
  });

  if (variantsToCreate.length === 0) {
    console.log("[groupVariantsCreate] No variants to create.");
    return [];
  }

  console.log(`[groupVariantsCreate] Found ${variantsToCreate.length} variants to create mutations for.`);

  const PRODUCT_VARIANTS_BULK_CREATE_MUTATION = `
    mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants) {
        product {
          id
          title
        }
        productVariants {
          id
          title
          sku
          price
          selectedOptions {
            name
            value
          }
          inventoryItem {
            id
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // Group variants by product
  const variantsByProduct = new Map<string, any[]>();
  variantsToCreate.forEach(variant => {
    const productId = variant.product.shopifyProductId!;
    if (!variantsByProduct.has(productId)) {
      variantsByProduct.set(productId, []);
    }
    variantsByProduct.get(productId)!.push(variant);
  });

  // Create mutation variables for each product
  const mutationVariables = Array.from(variantsByProduct.entries()).map(([productId, productVariants]) => {
    const variantsInput = productVariants.map(variant => ({
      price: String(variant.priceNetto),
      optionValues: [
        {
          name: variant.title,
          optionName: variant.optionName || "Variante",
        },
      ],
      // Note: We can add inventory quantities here if needed
      // inventoryQuantities: [
      //   {
      //     availableQuantity: variant.quantity,
      //     locationId: process.env.SHOPIFY_LOCATION_ID!,
      //   },
      // ],
    }));

    return {
      productId: productId,
      variants: variantsInput,
    };
  });

  console.log(`[groupVariantsCreate] Created ${mutationVariables.length} mutation variables for ${variantsByProduct.size} products.`);

  // Return the mutation and variables for external execution
  return {
    mutation: PRODUCT_VARIANTS_BULK_CREATE_MUTATION,
    variables: mutationVariables,
    variants: variantsToCreate, // Include original variants for reference
    variantsByProduct: variantsByProduct, // Include grouped variants for reference
  };
};
