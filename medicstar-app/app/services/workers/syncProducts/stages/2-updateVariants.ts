import { $Enums } from "@prisma/client";
import prisma from "../../../../db.server";
import { getProductVariantsBySku, updateProductVariantsBulk, getStoreLocationId, setInventoryQuantities } from "../../../admin";

interface VariantData {
  sku: string;
  price: string;
  quantity: string;
}


export const processVariantBatch = async (process: any) => {
  console.log(`[processVariantBatch] Processing Process ID: ${process.id}`);

  try {

    // Get variant data from process
    const processData = process.data as any;
    const variants: VariantData[] = processData.variants || [];

    if (variants.length === 0) {
      throw new Error("No variants found in process data");
    }

    console.log(`[processVariantBatch] Processing ${variants.length} variants for Process ID: ${process.id}`);

    // Get SKUs to query
    const skus = variants.map(v => v.sku);

    // Get existing variants from Shopify
    const existingVariants = await getProductVariantsBySku(skus);
    console.log(`[processVariantBatch] Found ${existingVariants.length} existing variants in Shopify`);

    // Create mapping of SKU to Shopify variant
    const skuToVariant = new Map<string, any>();
    existingVariants.forEach(variant => {
      if (variant.sku) {
        skuToVariant.set(variant.sku, variant);
      }
    });

    // Prepare bulk update data for prices
    const bulkUpdateData: Array<{
      id: string;
      productId: string;
      price?: string;
    }> = [];

    // Prepare inventory update data
    const inventoryUpdateData: Array<{
      inventoryItemId: string;
      locationId: string;
      quantity: number;
    }> = [];

    let updatedCount = 0;
    let skippedCount = 0;

    // Get store location ID once
    const locationId = await getStoreLocationId();

    for (const variant of variants) {
      const existingVariant = skuToVariant.get(variant.sku);

      if (!existingVariant) {
        console.log(`[processVariantBatch] Variant with SKU ${variant.sku} not found in Shopify, skipping`);
        skippedCount++;
        continue;
      }

      // Check if update is needed
      const needsPriceUpdate = existingVariant.price !== variant.price;
      const needsQuantityUpdate = existingVariant.inventoryQuantity !== parseInt(variant.quantity);

      if (needsPriceUpdate || needsQuantityUpdate) {
        if (needsPriceUpdate) {
          bulkUpdateData.push({
            id: existingVariant.id,
            productId: existingVariant.product.id,
            price: variant.price
          });
        }

        if (needsQuantityUpdate) {
          inventoryUpdateData.push({
            inventoryItemId: existingVariant.inventoryItem.id,
            locationId: locationId,
            quantity: parseInt(variant.quantity)
          });
        }

        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`[processVariantBatch] ${updatedCount} variants need updates, ${skippedCount} skipped`);
    console.log(`[processVariantBatch] Price updates: ${bulkUpdateData.length}, Inventory updates: ${inventoryUpdateData.length}`);

    // Perform price updates if needed
    if (bulkUpdateData.length > 0) {
      console.log(`[processVariantBatch] Updating ${bulkUpdateData.length} variant prices...`);

      const result = await updateProductVariantsBulk(bulkUpdateData);

      if (result.userErrors && result.userErrors.length > 0) {
        const errorMessages = result.userErrors.map(err => err.message).join('; ');
        throw new Error(`Shopify price update errors: ${errorMessages}`);
      }

      console.log(`[processVariantBatch] Successfully updated ${result.productVariants.length} variant prices`);
    }

    // Perform inventory updates if needed
    if (inventoryUpdateData.length > 0) {
      console.log(`[processVariantBatch] Setting inventory quantities for ${inventoryUpdateData.length} items...`);

      const inventoryResult = await setInventoryQuantities(inventoryUpdateData);

      if (!inventoryResult.success || inventoryResult.userErrors.length > 0) {
        const errorMessages = inventoryResult.userErrors.map(err => err.message).join('; ');
        throw new Error(`Shopify inventory update errors: ${errorMessages}`);
      } else {
        console.log(`[processVariantBatch] Successfully updated inventory quantities for ${inventoryUpdateData.length} items`);
      }
    }

    if (bulkUpdateData.length === 0 && inventoryUpdateData.length === 0) {
      console.log(`[processVariantBatch] No variants need updates`);
    }

    // Mark process as completed
    await prisma.process.update({
      where: { id: process.id },
      data: {
        status: $Enums.Status.COMPLETED,
        logMessage: `Process completed successfully: ${updatedCount} variants processed (${bulkUpdateData.length} price updates, ${inventoryUpdateData.length} inventory updates), ${skippedCount} skipped`
      }
    });

    // After completing UPDATE_VARIANTS, create next process
    const currentProcessData = process.data as any;
    const batchNumber = currentProcessData.batchNumber || 1;
    const totalBatches = currentProcessData.totalBatches || 1;

    if (batchNumber < totalBatches) {
      // Create next batch process
      const job = await prisma.job.findUnique({
        where: { id: process.jobId },
        select: { data: true }
      });

      if (job && job.data) {
        const jobData = job.data as any;
        const allVariants = jobData.variants || [];
        const nextBatchNumber = batchNumber + 1;
        const nextBatch = allVariants.slice((nextBatchNumber - 1) * 250, nextBatchNumber * 250);

        if (nextBatch.length > 0) {
          await prisma.process.create({
            data: {
              jobId: process.jobId,
              type: $Enums.ProcessType.CREATE_NEXT_PROCESS,
              status: $Enums.Status.PENDING,
              logMessage: `Create next process for batch ${nextBatchNumber}`,
              data: {
                variants: nextBatch as any,
                batchNumber: nextBatchNumber,
                totalBatches: totalBatches
              }
            }
          });
          console.log(`[processVariantBatch] Created CREATE_NEXT_PROCESS for batch ${nextBatchNumber}`);
        }
      }
    } else {
      // All batches completed, create FINISH process
      await prisma.process.create({
        data: {
          jobId: process.jobId,
          type: $Enums.ProcessType.FINISH,
          status: $Enums.Status.PENDING,
          logMessage: `All variant updates completed, ready to finish job`
        }
      });
      console.log(`[processVariantBatch] Created FINISH process for job ${process.jobId}`);
    }

    console.log(`[processVariantBatch] ✅ Process ID: ${process.id} completed successfully`);

  } catch (error) {
    console.error(`[processVariantBatch] ❌ Process ID: ${process.id} failed:`, error);
    throw error; // Re-throw to let runProcessWrapper handle it
  }
};
