import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { $Enums } from "@prisma/client";


export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, payload } = await authenticate.webhook(request);

  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }

  processBulkOperationFinish(shop, payload).catch(console.error);
  return new Response();
};

export const processBulkOperationFinish = async (shop: string, payload: any) => {
  console.log(`[webhook] Received bulk_operations/finish webhook for shop: ${shop}`);
  console.log(`[webhook] Payload:`, JSON.stringify(payload, null, 2));

  // Parse the webhook payload
  const bulkOperationData = payload as {
    admin_graphql_api_id: string;
    completed_at: string;
    created_at: string;
    error_code: string | null;
    status: string;
    type: string;
    client_identifier?: string;
  };

  console.log(`[webhook] Bulk Operation Details:`);
  console.log(`  - ID: ${bulkOperationData.admin_graphql_api_id}`);
  console.log(`  - Status: ${bulkOperationData.status}`);
  console.log(`  - Type: ${bulkOperationData.type}`);
  console.log(`  - Created: ${bulkOperationData.created_at}`);
  console.log(`  - Completed: ${bulkOperationData.completed_at}`);
  console.log(`  - Error Code: ${bulkOperationData.error_code}`);
  console.log(`  - Client Identifier: ${bulkOperationData.client_identifier}`);

  // Process the bulk operation results
  try {
    await processBulkOperationResults(bulkOperationData);

    // Log completion status
    if (bulkOperationData.status === "completed" && !bulkOperationData.error_code) {
      console.log(`[webhook] ✅ ${bulkOperationData.client_identifier} operation completed successfully!`);
    } else if (bulkOperationData.error_code) {
      console.log(`[webhook] ❌ ${bulkOperationData.client_identifier} operation failed: ${bulkOperationData.error_code}`);
    }
  } catch (error) {
    console.error(`[webhook] Error processing bulk operation results:`, error);
  }
};

// Process bulk operation results and update database
async function processBulkOperationResults(bulkOperationData: any) {
  console.log(`[webhook] Processing bulk operation results...`);

  // Find the SyncProductsTask record - try multiple approaches
  let syncTask = await prisma.syncProductsTask.findFirst({
    where: {
      inProgress: true,
      stage: $Enums.StatusEnum.WAIT_FOR_FINISH
    },
    orderBy: { updatedAt: 'desc' },
  });

  // If not found, try finding by stage only
  if (!syncTask) {
    syncTask = await prisma.syncProductsTask.findFirst({
      where: {
        stage: $Enums.StatusEnum.WAIT_FOR_FINISH
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // If still not found, try finding any in-progress task
  if (!syncTask) {
    syncTask = await prisma.syncProductsTask.findFirst({
      where: { inProgress: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  if (!syncTask) {
    console.log(`[webhook] No active SyncProductsTask found`);
    return;
  }

  console.log(`[webhook] Found SyncProductsTask: ${syncTask.id}, stage: ${syncTask.stage}, inProgress: ${syncTask.inProgress}`);
  console.log(`[webhook] Current task data:`, JSON.stringify(syncTask.data, null, 2));

  // Update SyncProductsTask based on operation type and status
  switch (bulkOperationData.client_identifier) {
    case "products-bulk-create":
      await handleProductBulkOperation(syncTask, bulkOperationData);
      break;
    case "variants-bulk-create":
      await handleVariantBulkOperation(syncTask, bulkOperationData);
      break;
    default:
      console.warn(`[webhook] Unknown client identifier: ${bulkOperationData.client_identifier}`);
      break;
  }

  console.log(`[webhook] Updated SyncProductsTask status to: ${bulkOperationData.status === "completed" ? $Enums.StatusEnum.DOWNLOAD_RESULT : $Enums.StatusEnum.WAIT_FOR_FINISH}`);
}

// Handle product bulk operation completion
async function handleProductBulkOperation(syncTask: any, bulkOperationData: any) {
  console.log(`[webhook] Handling product bulk operation for task ${syncTask.id}`);

  await prisma.syncProductsTask.update({
    where: { id: syncTask.id },
    data: {
      stage: bulkOperationData.status === "completed" ? $Enums.StatusEnum.DOWNLOAD_RESULT : $Enums.StatusEnum.WAIT_FOR_FINISH,
      inProgress: bulkOperationData.status !== "completed",
      data: {
        ...syncTask.data as any,
        productOperationCompletedAt: bulkOperationData.completed_at,
        productOperationStatus: bulkOperationData.status,
        productOperationErrorCode: bulkOperationData.error_code,
        // Store bulk operation details for downloadResult
        bulkOperationId: bulkOperationData.admin_graphql_api_id,
        clientIdentifier: bulkOperationData.client_identifier,
      },
      error: bulkOperationData.error_code ? `Product operation failed: ${bulkOperationData.error_code}` : null,
    },
  });
}

// Handle variant bulk operation completion
async function handleVariantBulkOperation(syncTask: any, bulkOperationData: any) {
  console.log(`[webhook] Handling variant bulk operation for task ${syncTask.id}`);

  await prisma.syncProductsTask.update({
    where: { id: syncTask.id },
    data: {
      stage: bulkOperationData.status === "completed" ? $Enums.StatusEnum.DOWNLOAD_RESULT : $Enums.StatusEnum.WAIT_FOR_FINISH,
      inProgress: bulkOperationData.status !== "completed",
      data: {
        ...syncTask.data as any,
        variantOperationCompletedAt: bulkOperationData.completed_at,
        variantOperationStatus: bulkOperationData.status,
        variantOperationErrorCode: bulkOperationData.error_code,
        // Store bulk operation details for downloadResult
        bulkOperationId: bulkOperationData.admin_graphql_api_id,
        clientIdentifier: bulkOperationData.client_identifier,
      },
      error: bulkOperationData.error_code ? `Variant operation failed: ${bulkOperationData.error_code}` : null,
    },
  });
}

