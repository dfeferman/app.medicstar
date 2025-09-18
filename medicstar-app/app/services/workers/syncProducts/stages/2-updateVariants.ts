import { $Enums } from "@prisma/client";
import prisma from "../../../../db.server";
import { getProductVariantsBySku, updateProductVariantsBulk, getStoreLocationId, setInventoryQuantities } from "../../../admin";
import { cleanupDownloadedFile } from "../../helpers/removeFile";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";


interface VariantData {
  sku: string;
  price: string;
  quantity: string;
}

const processVariantBatchTask = async (process: ProcessWithShop) => {
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
    const existingVariants = await getProductVariantsBySku(skus, process.shop.domain);
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
    const locationId = await getStoreLocationId(process.shop.domain);

    for (const variant of variants) {
      const existingVariant = skuToVariant.get(variant.sku);

      if (!existingVariant) {
        console.log(`[processVariantBatch] Variant with SKU ${variant.sku} not found in Shopify, skipping`);
        skippedCount++;
        continue;
      }

      // Log detailed comparison for debugging
      console.log(`[processVariantBatch] === COMPARING VARIANT ${variant.sku} ===`);
      console.log(`[processVariantBatch] Existing price: "${existingVariant.price}" (type: ${typeof existingVariant.price})`);
      console.log(`[processVariantBatch] New price: "${variant.price}" (type: ${typeof variant.price})`);
      console.log(`[processVariantBatch] Existing quantity: ${existingVariant.inventoryQuantity} (type: ${typeof existingVariant.inventoryQuantity})`);
      console.log(`[processVariantBatch] New quantity: ${variant.quantity} (type: ${typeof variant.quantity})`);

      // Check if update is needed
      // Normalize prices to handle decimal precision differences (e.g., "22.40" vs "22.4")
      const existingPrice = parseFloat(existingVariant.price).toString();
      const newPrice = parseFloat(variant.price).toString();
      const needsPriceUpdate = existingPrice !== newPrice;
      const needsQuantityUpdate = existingVariant.inventoryQuantity !== parseInt(variant.quantity);

      console.log(`[processVariantBatch] Normalized existing price: "${existingPrice}"`);
      console.log(`[processVariantBatch] Normalized new price: "${newPrice}"`);
      console.log(`[processVariantBatch] Needs price update: ${needsPriceUpdate}`);
      console.log(`[processVariantBatch] Needs quantity update: ${needsQuantityUpdate}`);

      if (needsPriceUpdate || needsQuantityUpdate) {
        console.log(`[processVariantBatch] ⚠️  VARIANT ${variant.sku} NEEDS UPDATE`);

        if (needsPriceUpdate) {
          console.log(`[processVariantBatch] 📝 PRICE UPDATE: "${existingVariant.price}" → "${variant.price}"`);
          bulkUpdateData.push({
            id: existingVariant.id,
            productId: existingVariant.product.id,
            price: variant.price
          });
        }

        if (needsQuantityUpdate) {
          console.log(`[processVariantBatch] 📦 QUANTITY UPDATE: ${existingVariant.inventoryQuantity} → ${parseInt(variant.quantity)}`);
          inventoryUpdateData.push({
            inventoryItemId: existingVariant.inventoryItem.id,
            locationId: locationId,
            quantity: parseInt(variant.quantity)
          });
        }

        updatedCount++;
      } else {
        console.log(`[processVariantBatch] ✅ VARIANT ${variant.sku} NO CHANGES NEEDED`);
        skippedCount++;
      }
      console.log(`[processVariantBatch] === END COMPARISON ===`);
    }

    console.log(`[processVariantBatch] ${updatedCount} variants need updates, ${skippedCount} skipped`);
    console.log(`[processVariantBatch] Price updates: ${bulkUpdateData.length}, Inventory updates: ${inventoryUpdateData.length}`);

    // Perform price updates if needed
    if (bulkUpdateData.length > 0) {
      console.log(`[processVariantBatch] Updating ${bulkUpdateData.length} variant prices...`);

      const result = await updateProductVariantsBulk(bulkUpdateData, process.shop.domain);

      if (result.userErrors && result.userErrors.length > 0) {
        const errorMessages = result.userErrors.map(err => err.message).join('; ');
        throw new Error(`Shopify price update errors: ${errorMessages}`);
      }

      console.log(`[processVariantBatch] Successfully updated ${result.productVariants.length} variant prices`);
    }

    // Perform inventory updates if needed
    if (inventoryUpdateData.length > 0) {
      console.log(`[processVariantBatch] Setting inventory quantities for ${inventoryUpdateData.length} items...`);

      const inventoryResult = await setInventoryQuantities(inventoryUpdateData, process.shop.domain);

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

    // Create FINISH process
    await prisma.process.create({
      data: {
        jobId: process.jobId,
        shopId: process.shopId,
        type: $Enums.ProcessType.FINISH,
        status: $Enums.Status.PENDING,
        logMessage: `Finish process created for job ${process.jobId}`
      }
    });

    console.log(`[processVariantBatch] Created FINISH process for job ${process.jobId}`);

    console.log(`[processVariantBatch] ✅ Process ID: ${process.id} completed successfully`);
};

export const processVariantBatch = async (process: any) => {
  await runProcessWrapper(process, processVariantBatchTask);
};


