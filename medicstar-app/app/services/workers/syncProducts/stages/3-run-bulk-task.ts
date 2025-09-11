import { groupProductCreate } from "../../helpers/mutations/groupProductCreate";
import { groupVariantsCreate } from "../../helpers/mutations/groupVariantsCreate";
import { runBulkMutation } from "../../helpers/create-bulk-task";
import { $Enums } from "@prisma/client";
import prisma from "../../../../db.server";

export const runBulkTask = async () => {
  console.log("[run-bulk-task] Starting bulk operation...");

  // Check what needs to be created and run the appropriate bulk operation
  const productsToCreate = await groupProductCreate();
  const variantsToCreate = await groupVariantsCreate();

  // Determine which operation to run based on what's available
  const operationType = determineOperationType(productsToCreate, variantsToCreate);

  switch (operationType) {
    case "products":
      await executeProductBulkOperation(productsToCreate);
      break;
    case "variants":
      await executeVariantBulkOperation(variantsToCreate);
      break;
    case "none":
      console.log(`[run-bulk-task] No products or variants to create. Setting status to FINISH.`);
      // No operations to perform, set status to FINISH
      return "FINISH";
    default:
      throw new Error(`Unknown operation type: ${operationType}`);
  }
};

// Determine which operation type to run
function determineOperationType(productsToCreate: any, variantsToCreate: any): string {
  const hasProducts = Array.isArray(productsToCreate) === false &&
                     productsToCreate.variables &&
                     productsToCreate.variables.length > 0;

  const hasVariants = Array.isArray(variantsToCreate) === false &&
                     variantsToCreate.variables &&
                     variantsToCreate.variables.length > 0;

  if (hasProducts) {
    return "products";
  } else if (hasVariants) {
    return "variants";
  } else {
    return "none";
  }
}

// Execute product bulk operation
async function executeProductBulkOperation(productsToCreate: any) {
  console.log(`[run-bulk-task] Found ${productsToCreate.variables.length} products to create.`);

  const productResult = await runBulkMutation(
    productsToCreate.mutation,
    productsToCreate.variables,
    { clientIdentifier: "products-bulk-create" }
  );

  if (productResult.bulkOperation) {
    console.log(`[run-bulk-task] ✅ Product bulk operation started successfully.`);
    console.log(`[run-bulk-task] Operation ID: ${productResult.bulkOperation.id}`);
  } else {
    throw new Error(`Product operation failed: ${JSON.stringify(productResult.userErrors)}`);
  }
}

// Execute variant bulk operation
async function executeVariantBulkOperation(variantsToCreate: any) {
  console.log(`[run-bulk-task] Found ${variantsToCreate.variables.length} product groups with variants to create.`);

  const variantResult = await runBulkMutation(
    variantsToCreate.mutation,
    variantsToCreate.variables,
    { clientIdentifier: "variants-bulk-create" }
  );

  if (variantResult.bulkOperation) {
    console.log(`[run-bulk-task] ✅ Variant bulk operation started successfully.`);
    console.log(`[run-bulk-task] Operation ID: ${variantResult.bulkOperation.id}`);
  } else {
    throw new Error(`Variant operation failed: ${JSON.stringify(variantResult.userErrors)}`);
  }
}


// Function to be used with runTaskWrapper
export const createBulkTask = async (task: any) => {
    const result = await runBulkTask();

    if (result === "FINISH") {
      // No more operations to perform, set status to FINISH
      await prisma.syncProductsTask.update({
        where: { id: task.id },
        data: {
          stage: $Enums.StatusEnum.FINISH,
          inProgress: false,
          data: {
            ...task.data as any,
            allBulkTasksCompletedAt: new Date().toISOString(),
          },
          error: null,
        },
      });

      console.log(`[createBulkTask] ✅ All bulk tasks completed. Updated task to FINISH.`);
    } else {
      // Update task status to wait for finish
      await prisma.syncProductsTask.update({
        where: { id: task.id },
        data: {
          stage: $Enums.StatusEnum.WAIT_FOR_FINISH,
          inProgress: true,
          data: {
            ...task.data as any,
            bulkTaskStartedAt: new Date().toISOString(),
          },
          error: null,
        },
      });

      console.log(`[createBulkTask] ✅ Bulk task started. Updated task to WAIT_FOR_FINISH.`);
    }
};

