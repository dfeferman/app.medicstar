import "dotenv/config.js";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import prisma from "../../../../db.server";
import { $Enums } from "@prisma/client";
import { unauthenticated } from "../../../../shopify.server";

const DOWNLOADS_FOLDER = "downloads";
const SHOP_DOMAIN = process.env.SHOP_DOMAIN!;

export const downloadResult = async (task: any) => {
  console.log(`[downloadResult] Starting download of bulk operation results for task ${task.id}`);

  try {
    const taskData = task.data as any;
    const bulkOperationId = taskData.bulkOperationId;
    const clientIdentifier = taskData.clientIdentifier;

    if (!bulkOperationId) {
      throw new Error("No bulk operation ID found in task data");
    }

    console.log(`[downloadResult] Downloading results for bulk operation: ${bulkOperationId}`);
    console.log(`[downloadResult] Client identifier: ${clientIdentifier}`);

    // Ensure downloads folder exists
    if (!fs.existsSync(DOWNLOADS_FOLDER)) {
      fs.mkdirSync(DOWNLOADS_FOLDER, { recursive: true });
    }

    // Get Shopify GraphQL client
    const {
      admin: { graphql },
    } = await unauthenticated.admin(SHOP_DOMAIN);

    // Query the bulk operation status
    const result = await graphql(`
      query getBulkOperation($id: ID!) {
        node(id: $id) {
          ... on BulkOperation {
            id
            status
            errorCode
            createdAt
            completedAt
            objectCount
            fileSize
            url
            partialDataUrl
          }
        }
      }
    `, {
      variables: {
        id: bulkOperationId
      }
    });

    const body = await result.json();

    if (!result.ok) {
      throw new Error(`GraphQL request failed: ${JSON.stringify(body)}`);
    }

    const bulkOperation = body.data.node;
    if (!bulkOperation) {
      throw new Error(`Bulk operation ${bulkOperationId} not found`);
    }

    console.log(`[downloadResult] Bulk operation status: ${bulkOperation.status}`);
    console.log(`[downloadResult] Object count: ${bulkOperation.objectCount}`);
    console.log(`[downloadResult] File size: ${bulkOperation.fileSize}`);

    // Check operation status according to Shopify documentation
    // Note: Shopify returns status in uppercase (COMPLETED, FAILED, CANCELED)
    const status = bulkOperation.status.toLowerCase();

    if (status === "failed") {
      throw new Error(`Bulk operation failed with error code: ${bulkOperation.errorCode || 'Unknown error'}`);
    }

    if (status === "canceled") {
      throw new Error("Bulk operation was canceled");
    }

    if (status !== "completed") {
      throw new Error(`Bulk operation is not completed. Status: ${bulkOperation.status}`);
    }

    if (!bulkOperation.url) {
      throw new Error("No download URL available for bulk operation results");
    }

    // Download the results file (always JSONL format according to Shopify docs)
    const resultsResponse = await axios.get(bulkOperation.url, { responseType: "stream" });
    const timestamp = Date.now();
    const filePath = path.join(DOWNLOADS_FOLDER, `bulk_results_${clientIdentifier}_${timestamp}.jsonl`);

    await new Promise<void>((resolve, reject) => {
      const writer = fs.createWriteStream(filePath);
      resultsResponse.data.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    console.log(`[downloadResult] Results file saved to: ${filePath}`);
    console.log(`[downloadResult] File format: JSONL (JSON Lines) - each line is a separate JSON object`);

    // Update task status to next stage
    await prisma.syncProductsTask.update({
      where: { id: task.id },
      data: {
        stage: $Enums.StatusEnum.PROCESS_RESULT,
        inProgress: false,
        data: {
          ...taskData,
          downloadResultCompletedAt: new Date().toISOString(),
          resultsFilePath: filePath,
          bulkOperationObjectCount: bulkOperation.objectCount,
          bulkOperationFileSize: bulkOperation.fileSize,
        },
        error: null,
      },
    });

    console.log(`[downloadResult] ✅ Results download completed successfully. Updated task to PROCESS_RESULT.`);

  } catch (error) {
    console.error(`[downloadResult] Error downloading results:`, error);

    // Update task with error
    await prisma.syncProductsTask.update({
      where: { id: task.id },
      data: {
        inProgress: false,
        error: `Download result failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    });

    throw error;
  }
};
