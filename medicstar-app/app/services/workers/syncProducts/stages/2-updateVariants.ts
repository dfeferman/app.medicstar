import { $Enums } from "@prisma/client";
import type { Process } from '@prisma/client';
import prisma from "../../../../db.server";
import { getProductVariantsBySku } from "../../../admin/get-product-variants-by-sku";
import { updateProductVariantsBulk } from "../../../admin/update-product-variants-bulk";
import { getStoreLocationId } from "../../../admin/get-store-location-id";
import { setInventoryQuantities } from "../../../admin/set-inventory-quantities";
import { runProcessWrapper, ProcessWithShop } from "../../helpers/runProcessWrapper";
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
      const csvPrice = parseFloat(csvVariant.price).toString();
      const needsPriceUpdate = currentShopifyPrice !== csvPrice;
      const needsQuantityUpdate = existingShopifyVariant.inventoryQuantity !== parseInt(csvVariant.quantity);

      if (needsPriceUpdate || needsQuantityUpdate) {
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
            quantity: parseInt(csvVariant.quantity)
          });
        }

        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    if (priceUpdateData.length > 0) {
      const result = await updateProductVariantsBulk(priceUpdateData, process.shop.domain);

      if (result.userErrors && result.userErrors.length > 0) {
        const errorMessages = result.userErrors.map(err => err.message).join('; ');
        throw new Error(`Shopify price update errors: ${errorMessages}`);
      }
    }

    if (inventoryUpdateData.length > 0) {
      const inventoryResult = await setInventoryQuantities(inventoryUpdateData, process.shop.domain);

      if (!inventoryResult.success || inventoryResult.userErrors.length > 0) {
        const errorMessages = inventoryResult.userErrors.map(err => err.message).join('; ');
        throw new Error(`Shopify inventory update errors: ${errorMessages}`);
      }
    }

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
