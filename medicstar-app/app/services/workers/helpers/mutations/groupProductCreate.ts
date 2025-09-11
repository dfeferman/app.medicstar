import prisma from "../../../../db.server";

export const groupProductCreate = async () => {
  // Get products with empty shopifyProductId, including their variants
  const productsToCreate = await prisma.product.findMany({
    where: { shopifyProductId: null },
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
      groupId: true,
      variants: {
        select: {
          id: true,
          title: true,
          optionName: true,
          SKU: true,
          priceNetto: true,
          quantity: true,
        },
      },
    },
  });

  if (productsToCreate.length === 0) {
    console.log("[groupProductCreate] No products to create.");
    return [];
  }

  console.log(`[groupProductCreate] Found ${productsToCreate.length} products to create mutations for.`);

  const PRODUCT_CREATE_MUTATION = `
    mutation productCreate($input: ProductCreateInput!) {
      productCreate(product: $input) {
        product {
          id
          title
          vendor
          description
          options {
            id
            name
            position
            optionValues {
              id
              name
              hasVariants
            }
          }
          variants(first: 1) {
            nodes {
              id
              title
              sku
              price
              inventoryItem {
                id
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // Create mutation variables for each product
  const mutationVariables = productsToCreate.map(product => {
    // Build tags from collections
    const tags = [
      product.collection1,
      product.collection2,
      product.collection3,
      product.collection4,
    ].filter((t) => !!t && t.trim().length > 0);

    // Handle product options - only create options if product has variants
    let productOptions = undefined;
    if (product.variants && product.variants.length > 0) {
      const optionName = product.variants[0]?.optionName || "Variante";
      const variantValues = Array.from(new Set(product.variants.map((v: any) => v.title).filter(Boolean)));

      productOptions = [
        {
          name: optionName,
          values: variantValues.map((name) => ({ name })),
        },
      ];
    }

    return {
      input: {
        title: product.title,
        descriptionHtml: product.description ?? "",
        vendor: product.vendor,
        tags,
        productOptions,
      },
    };
  });

  console.log(`[groupProductCreate] Created ${mutationVariables.length} mutation variables.`);

  return {
    mutation: PRODUCT_CREATE_MUTATION,
    variables: mutationVariables,
    products: productsToCreate,
  };
};
