import { Card, BlockStack, Text, Banner } from "@shopify/polaris";
import CurrentJobCard from "./CurrentJobCard";

interface Process {
  id: number;
  type: string;
  status: string;
  logMessage: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Task {
  id: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  logMessage: string;
  data?: any;
  processes: Process[];
}

interface ProductSyncStatusCardProps {
  productTask: Task | null;
  productProgress: number;
  isProductJobActive: boolean;
  isProductJobCompleted: boolean;
  hasProductJobError: boolean;
  pendingProductJobsCount: number;
}

const ProductSyncStatusCard = ({
  productTask,
  productProgress,
  isProductJobActive,
  isProductJobCompleted,
  hasProductJobError,
  pendingProductJobsCount,
}: ProductSyncStatusCardProps) => {
  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingLg">Product Synchronization</Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          Monitor the status of product data synchronization including prices and inventory quantities.
        </Text>
        {productTask ? (
          <CurrentJobCard
            task={productTask}
            currentProgress={productProgress}
            isJobActive={isProductJobActive || false}
            isJobCompleted={isProductJobCompleted || false}
            hasJobError={hasProductJobError || false}
            pendingJobsCount={pendingProductJobsCount}
          />
        ) : (
          <Banner>
            No product sync job found. Start a sync from the settings page or wait for the next auto sync.
          </Banner>
        )}
      </BlockStack>
    </Card>
  );
};

export default ProductSyncStatusCard;
