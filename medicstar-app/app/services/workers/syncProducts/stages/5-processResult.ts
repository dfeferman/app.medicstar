import * as fs from "fs";
import * as path from "path";
import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";

export const processResult = async (task: any) => {
  console.log(`[processResult] Starting processing of bulk operation results for task ${task.id}`);

  try {
    const taskData = task.data as any;
    const resultsFilePath = taskData.resultsFilePath;
    const clientIdentifier = taskData.clientIdentifier;

    if (!resultsFilePath) {
      throw new Error("No results file path found in task data");
    }

    if (!fs.existsSync(resultsFilePath)) {
      throw new Error(`Results file not found: ${resultsFilePath}`);
    }

    console.log(`[processResult] Processing results file: ${resultsFilePath}`);
    console.log(`[processResult] Client identifier: ${clientIdentifier}`);

    // Read and parse the results file
    // According to Shopify docs: bulk operation results are always in JSONL format
    const fileContent = fs.readFileSync(resultsFilePath, 'utf8');
    const isJsonl = resultsFilePath.endsWith('.jsonl');

    let results: any[] = [];
    if (isJsonl) {
      // Parse JSONL (JSON Lines) format - each line is a separate JSON object
      // This is the standard format for Shopify bulk operation results
      results = fileContent
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    } else {
      // Fallback for regular JSON format (shouldn't happen with Shopify bulk ops)
      results = JSON.parse(fileContent);
    }

    console.log(`[processResult] Found ${results.length} results to process`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each result based on the client identifier
    for (const result of results) {
      try {
        if (clientIdentifier === "products-bulk-create") {
          await processProductResult(result);
        } else if (clientIdentifier === "variants-bulk-create") {
          await processVariantResult(result);
        } else {
          console.warn(`[processResult] Unknown client identifier: ${clientIdentifier}`);
        }
        successCount++;
      } catch (error) {
        errorCount++;
        const errorMsg = `Error processing result: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.error(`[processResult] ${errorMsg}`, result);
      }
    }

    console.log(`[processResult] Processing completed: ${successCount} successful, ${errorCount} errors`);

    // Update task status to create next bulk task (if any)
    await prisma.syncProductsTask.update({
      where: { id: task.id },
      data: {
        stage: $Enums.StatusEnum.CREATE_BULK_TASK,
        inProgress: false,
        data: {
          ...taskData,
          processResultCompletedAt: new Date().toISOString(),
          processedResultsCount: results.length,
          successCount,
          errorCount,
          processingErrors: errors.length > 0 ? errors : null,
        },
        error: errorCount > 0 ? `Processing completed with ${errorCount} errors` : null,
      },
    });

    console.log(`[processResult] ✅ Results processing completed successfully. Updated task to CREATE_BULK_TASK for next operation.`);

  } catch (error) {
    console.error(`[processResult] Error processing results:`, error);

    // Update task with error
    await prisma.syncProductsTask.update({
      where: { id: task.id },
      data: {
        inProgress: false,
        error: `Process result failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    });

    throw error;
  }
};

async function processProductResult(result: any) {
  // Process product creation result
  if (result.data && result.data.productCreate) {
    const productCreate = result.data.productCreate;

    if (productCreate.userErrors && productCreate.userErrors.length > 0) {
      throw new Error(`Product creation errors: ${JSON.stringify(productCreate.userErrors)}`);
    }

    if (productCreate.product) {
      const product = productCreate.product;
      console.log(`[processResult] Successfully created product: ${product.id} (${product.title})`);

      // Update our local product record with Shopify ID
      // Match by product title since SKUs are not set in Shopify
      const updated = await prisma.product.updateMany({
        where: {
          title: product.title,
        },
        data: {
          shopifyProductId: product.id,
        },
      });
      console.log(`[processResult] Updated product with Shopify ID: Title="${product.title}", ShopifyID=${product.id}, Updated=${updated.count} records`);

      // Also update the default variant's Shopify ID
      // The default variant is the one with the same SKU as the product
      if (product.variants && product.variants.nodes && product.variants.nodes.length > 0) {
        const defaultVariant = product.variants.nodes[0]; // First variant is usually the default

        // Find the local product we just updated
        const localProduct = await prisma.product.findFirst({
          where: { shopifyProductId: product.id }
        });

        if (localProduct) {
          // Find the variant that has the same SKU as the product (default variant)
          const updatedVariant = await prisma.productVariant.updateMany({
            where: {
              productId: localProduct.id,
              SKU: localProduct.SKU, // Same SKU as product = default variant
            },
            data: {
              shopifyVariantId: defaultVariant.id,
            },
          });
          console.log(`[processResult] Updated default variant with Shopify ID: ProductID=${localProduct.id}, SKU=${localProduct.SKU}, ShopifyID=${defaultVariant.id}, Updated=${updatedVariant.count} records`);
        }
      }
    }
  }
}

async function processVariantResult(result: any) {
  // Process variant creation result
  if (result.data && result.data.productVariantsBulkCreate) {
    const variantCreate = result.data.productVariantsBulkCreate;

    if (variantCreate.userErrors && variantCreate.userErrors.length > 0) {
      throw new Error(`Variant creation errors: ${JSON.stringify(variantCreate.userErrors)}`);
    }

    if (variantCreate.productVariants && variantCreate.productVariants.length > 0) {
      // Get the product ID from the variant creation result (it's at the top level)
      const productId = variantCreate.product?.id;

      if (!productId) {
        console.warn(`[processResult] No product ID found in variant creation result`);
        return;
      }

      // First find the local product by Shopify ID
      const localProduct = await prisma.product.findFirst({
        where: { shopifyProductId: productId }
      });

      if (!localProduct) {
        console.warn(`[processResult] Could not find local product for Shopify product ID: ${productId}`);
        return;
      }

      console.log(`[processResult] Found local product: ID=${localProduct.id}, Title="${localProduct.title}"`);

      for (const variant of variantCreate.productVariants) {
        console.log(`[processResult] Successfully created variant: ${variant.id} (${variant.title})`);

        // Update our local variant record with Shopify ID
        // Match by product ID and variant title
        const updated = await prisma.productVariant.updateMany({
          where: {
            productId: localProduct.id,
            title: variant.title,
          },
          data: {
            shopifyVariantId: variant.id,
          },
        });
        console.log(`[processResult] Updated variant with Shopify ID: ProductID=${localProduct.id}, Title="${variant.title}", ShopifyID=${variant.id}, Updated=${updated.count} records`);
      }
    }
  }
}
