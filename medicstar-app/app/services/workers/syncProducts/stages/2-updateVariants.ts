import { $Enums } from "@prisma/client";
import type { Process } from '@prisma/client';
import prisma from "../../../../db.server";
import { getProductVariantsBySku } from "../../../admin/get-product-variants-by-sku";
import { updateProductVariantsBulk } from "../../../admin/update-product-variants-bulk";
import { getStoreLocationId } from "../../../admin/get-store-location-id";
import { setInventoryQuantities } from "../../../admin/set-inventory-quantities";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";
import { syncProductsLogger } from "../../../../../lib/logger";
import { validateNonEmptyValue } from "../../../../utils/variantValidation";
interface VariantData {
  sku: string;
  price: string;
  quantity: string;
}
interface ProcessData {
  variants: VariantData[];
  batchNumber: number;
  totalBatches: number;
}
interface InventoryItem {
  id: string;
}
interface Product {
  id: string;
}
interface ShopifyVariant {
  id: string;
  sku: string;
  price: string;
  inventoryQuantity: number;
  inventoryItem: InventoryItem;
  product: Product;
}

interface PriceUpdateData {
  id: string;
  productId: string;
  price?: string;
}

interface InventoryUpdateData {
  inventoryItemId: string;
  locationId: string;
  quantity: number;
}


const processVariantBatchTask = async (process: ProcessWithShop) => {
    const processData = process.data as unknown as ProcessData;

    syncProductsLogger.info('Starting variant batch processing', {
      jobId: process.jobId,
      processId: process.id,
      shopDomain: process.shop.domain,
      batchNumber: processData.batchNumber,
      totalBatches: processData.totalBatches
    });

    const csvVariants: VariantData[] = processData.variants || [];

    if (csvVariants.length === 0) {
      throw new Error("No variants found in process data");
    }

    const skus = csvVariants.map(v => v.sku);

    const existingShopifyVariants = await getProductVariantsBySku(skus, process.shop.domain);

    const skuToShopifyVariantMap = new Map<string, ShopifyVariant>();
    existingShopifyVariants.forEach(variant => {
      if (variant.sku) {
        skuToShopifyVariantMap.set(variant.sku, variant);
      }
    });

    const priceUpdateData: PriceUpdateData[] = [];
    const inventoryUpdateData: InventoryUpdateData[] = [];

    let updatedCount = 0;
    let skippedCount = 0;

    const locationId = await getStoreLocationId(process.shop.domain);

    for (const csvVariant of csvVariants) {
      const existingShopifyVariant = skuToShopifyVariantMap.get(csvVariant.sku);

      if (!existingShopifyVariant) {
        skippedCount++;
        continue;
      }

      const currentShopifyPrice = parseFloat(existingShopifyVariant.price).toString();

      // Validate price
      const priceValidation = validateNonEmptyValue(csvVariant.price);
      if (!priceValidation.isValid) {
        syncProductsLogger.warn('Skipping variant with invalid price', {
          sku: csvVariant.sku,
          price: csvVariant.price,
          skipReason: priceValidation.skipReason
        });
        skippedCount++;
        continue;
      }

      // Validate inventory
      const inventoryValidation = validateNonEmptyValue(csvVariant.quantity);
      if (!inventoryValidation.isValid) {
        syncProductsLogger.warn('Skipping variant with invalid inventory', {
          sku: csvVariant.sku,
          quantity: csvVariant.quantity,
          skipReason: inventoryValidation.skipReason
        });
        skippedCount++;
        continue;
      }

      const csvPrice = priceValidation.parsedValue;
      const csvQuantity = inventoryValidation.parsedValue;

      const currentPriceRounded = parseFloat(currentShopifyPrice).toFixed(2);
      const csvPriceRounded = parseFloat(csvPrice).toFixed(2);

      const needsPriceUpdate = currentPriceRounded !== csvPriceRounded;
      const needsQuantityUpdate = existingShopifyVariant.inventoryQuantity !== parseInt(csvQuantity);

      if (needsPriceUpdate || needsQuantityUpdate) {
        // console.log(`🔄 UPDATING PRODUCT:`, {
        //   sku: csvVariant.sku,
        //   price: {
        //     current: currentShopifyPrice,
        //     new: csvPrice,
        //     currentRounded: currentPriceRounded,
        //     newRounded: csvPriceRounded,
        //     needsUpdate: needsPriceUpdate
        //   },
        //   inventory: {
        //     current: existingShopifyVariant.inventoryQuantity,
        //     new: parseInt(csvQuantity),
        //     needsUpdate: needsQuantityUpdate
        //   }
        // });

        if (needsPriceUpdate) {
          priceUpdateData.push({
            id: existingShopifyVariant.id,
            productId: existingShopifyVariant.product.id,
            price: csvVariant.price
          });
        }

        if (needsQuantityUpdate) {
          inventoryUpdateData.push({
            inventoryItemId: existingShopifyVariant.inventoryItem.id,
            locationId: locationId,
            quantity: parseInt(csvQuantity)
          });
        }

        updatedCount++;
      } else {
        // console.log(`⏭️ SKIPPING PRODUCT (no changes needed):`, {
        //   sku: csvVariant.sku,
        //   price: {
        //     current: currentShopifyPrice,
        //     csv: csvPrice,
        //     currentRounded: currentPriceRounded,
        //     csvRounded: csvPriceRounded
        //   },
        //   inventory: { current: existingShopifyVariant.inventoryQuantity, csv: parseInt(csvQuantity) }
        // });
        skippedCount++;
      }
    }

    if (priceUpdateData.length > 0) {
      syncProductsLogger.info('Updating product prices', {
        jobId: process.jobId,
        processId: process.id,
        priceUpdateCount: priceUpdateData.length
      });

      const result = await updateProductVariantsBulk(priceUpdateData, process.shop.domain);

      if (result.userErrors && result.userErrors.length > 0) {
        const errorMessages = result.userErrors.map(err => err.message).join('; ');
        syncProductsLogger.error('Shopify price update failed', {
          jobId: process.jobId,
          processId: process.id,
          errors: errorMessages
        });
        throw new Error(`Shopify price update errors: ${errorMessages}`);
      }
    }

    if (inventoryUpdateData.length > 0) {
      syncProductsLogger.info('Updating inventory quantities', {
        jobId: process.jobId,
        processId: process.id,
        inventoryUpdateCount: inventoryUpdateData.length
      });

      const inventoryResult = await setInventoryQuantities(inventoryUpdateData, process.shop.domain);

      if (!inventoryResult.success || inventoryResult.userErrors.length > 0) {
        const errorMessages = inventoryResult.userErrors.map(err => err.message).join('; ');
        syncProductsLogger.error('Shopify inventory update failed', {
          jobId: process.jobId,
          processId: process.id,
          errors: errorMessages
        });
        throw new Error(`Shopify inventory update errors: ${errorMessages}`);
      }
    }

    syncProductsLogger.info('Variant batch processing completed', {
      jobId: process.jobId,
      processId: process.id,
      updatedCount,
      skippedCount,
      priceUpdates: priceUpdateData.length,
      inventoryUpdates: inventoryUpdateData.length
    });

    await prisma.process.update({
      where: { id: process.id },
      data: {
        status: $Enums.Status.COMPLETED,
        logMessage: `Process completed successfully: ${updatedCount} csv variants processed (${priceUpdateData.length} price updates, ${inventoryUpdateData.length} inventory updates), ${skippedCount} skipped`
      }
    });

    const remainingProcesses = await prisma.process.count({
      where: {
        jobId: process.jobId,
        type: $Enums.ProcessType.UPDATE_VARIANTS,
        status: { in: [$Enums.Status.PENDING, $Enums.Status.PROCESSING] }
      }
    });

    if (remainingProcesses === 0) {
      await prisma.process.create({
        data: {
          jobId: process.jobId,
          shopId: process.shopId,
          type: $Enums.ProcessType.FINISH,
          status: $Enums.Status.PENDING,
          logMessage: `Finish process created for job ${process.jobId} - all batches completed`
        }
      });
    }
};

export const processVariantBatch = async (process: Process) => {
  await runProcessWrapper(process, processVariantBatchTask);
};
