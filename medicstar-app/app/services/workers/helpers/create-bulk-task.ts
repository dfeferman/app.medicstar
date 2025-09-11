import { unauthenticated } from "../../../shopify.server";

const SHOP_DOMAIN = process.env.SHOP_DOMAIN!;

export interface BulkMutationOptions {
  mutation: string;
  stagedUploadPath: string;
  clientIdentifier?: string;
}

export interface BulkOperationResult {
  bulkOperation: {
    id: string;
    status: string;
  };
  userErrors: Array<{
    field: string[];
    message: string;
  }>;
}

export const createBulkTask = async (
  options: BulkMutationOptions
): Promise<BulkOperationResult> => {
  const {
    admin: { graphql },
  } = await unauthenticated.admin(SHOP_DOMAIN);

  const bulkMutation = `
    mutation bulkOperationRunMutation(
      $mutation: String!,
      $stagedUploadPath: String!,
      $clientIdentifier: String
    ) {
      bulkOperationRunMutation(
        mutation: $mutation,
        stagedUploadPath: $stagedUploadPath,
        clientIdentifier: $clientIdentifier
      ) {
        bulkOperation {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    mutation: options.mutation,
    stagedUploadPath: options.stagedUploadPath,
    clientIdentifier: options.clientIdentifier,
  };

  const result = await graphql(bulkMutation, { variables });
  const body = await result.json();

  if (result.ok) {
    return body.data.bulkOperationRunMutation;
  } else {
    throw new Error(`Bulk operation failed: ${JSON.stringify(body)}`);
  }
};

// Helper function to create a staged upload for bulk operations
export const createStagedUpload = async (
  filename: string,
  contentType: string = "application/json"
): Promise<string> => {
  const {
    admin: { graphql },
  } = await unauthenticated.admin(SHOP_DOMAIN);

  const stagedUploadMutation = `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: [
      {
        filename,
        mimeType: contentType,
        resource: "BULK_MUTATION_VARIABLES",
      },
    ],
  };

  const result = await graphql(stagedUploadMutation, { variables });
  const body = await result.json();

  if (result.ok && body.data.stagedUploadsCreate.stagedTargets.length > 0) {
    return body.data.stagedUploadsCreate.stagedTargets[0].resourceUrl;
  } else {
    throw new Error(`Failed to create staged upload: ${JSON.stringify(body)}`);
  }
};

// Helper function to upload data to staged upload URL
export const uploadToStagedUrl = async (
  stagedUrl: string,
  data: any
): Promise<void> => {
  // Convert data to JSONL format (one JSON object per line)
  const jsonlData = data.map((item: any) => JSON.stringify(item)).join('\n');

  console.log(`[bulk-task] Uploading ${data.length} items to staged URL...`);
  console.log(`[bulk-task] Staged URL: ${stagedUrl}`);
  console.log(`[bulk-task] Data preview: ${jsonlData.substring(0, 200)}...`);

  const response = await fetch(stagedUrl, {
    method: "PUT",
    body: jsonlData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload to staged URL: ${response.status} ${response.statusText} - ${errorText}`);
  }

  console.log(`[bulk-task] Successfully uploaded data to staged URL`);
};

// Complete bulk operation workflow
export const runBulkMutation = async (
  mutation: string,
  variables: any[],
  options?: {
    clientIdentifier?: string;
  }
): Promise<BulkOperationResult> => {
  // 1. Create staged upload
  const stagedUploadPath = await createStagedUpload(
    `bulk-mutation-${Date.now()}.json`,
    "application/json"
  );

  // 2. Upload variables to staged URL
  await uploadToStagedUrl(stagedUploadPath, variables);

  // 3. Run bulk mutation
  return await createBulkTask({
    mutation,
    stagedUploadPath,
    clientIdentifier: options?.clientIdentifier,
  });
};
