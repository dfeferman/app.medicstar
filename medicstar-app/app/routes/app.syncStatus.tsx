import type { LoaderFunction } from "@remix-run/node";
import {
  Banner,
  BlockStack,
  Page,
  Card,
  Text,
  Divider,
} from "@shopify/polaris";
import { useLoaderData } from "@remix-run/react";
import { apiTaskLoader } from "../loaders/api.task.loader";
import CurrentJobCard from "../components/CurrentJobCard";
import TrackingCurrentJobCard from "../components/TrackingCurrentJobCard";
import { TitleBar } from "@shopify/app-bridge-react";

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

export const loader: LoaderFunction = apiTaskLoader;

export default function SyncStatusPage() {
  const {
    productTask,
    trackingTask,
    pendingProductJobsCount,
    pendingTrackingJobsCount
  } = useLoaderData<{
    productTask: Task | null;
    trackingTask: Task | null;
    pendingProductJobsCount: number;
    pendingTrackingJobsCount: number;
  }>();

  // Calculate progress for product sync
  const productProgress = productTask?.processes
    ? Math.round((productTask.processes.filter(p => p.status === 'COMPLETED').length / productTask.processes.length) * 100)
    : 0;

  // Calculate progress for tracking sync
  const trackingProgress = trackingTask?.processes
    ? Math.round((trackingTask.processes.filter(p => p.status === 'COMPLETED').length / trackingTask.processes.length) * 100)
    : 0;

  // Product sync status checks
  const isProductJobActive = productTask &&
    ['PENDING', 'PROCESSING'].includes(productTask.status) &&
    !productTask.processes.some(p => p.status === 'FAILED');

  const isProductJobCompleted = productTask &&
    (productTask.status === 'COMPLETED' || productTask.processes.every(p => p.status === 'COMPLETED'));

  const hasProductJobError = productTask &&
    (productTask.status === 'FAILED' || productTask.processes.some(p => p.status === 'FAILED'));

  // Tracking sync status checks
  const isTrackingJobActive = trackingTask &&
    ['PENDING', 'PROCESSING'].includes(trackingTask.status) &&
    !trackingTask.processes.some(p => p.status === 'FAILED');

  const isTrackingJobCompleted = trackingTask &&
    (trackingTask.status === 'COMPLETED' || trackingTask.processes.every(p => p.status === 'COMPLETED'));

  const hasTrackingJobError = trackingTask &&
    (trackingTask.status === 'FAILED' || trackingTask.processes.some(p => p.status === 'FAILED'));

  return (
    <Page>
      <TitleBar title="Synchronization Status" />
      <BlockStack gap="600">
        {/* Product Sync Section */}
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


        {/* Tracking Sync Section */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">Tracking Numbers Synchronization</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Monitor the status of tracking number synchronization for orders.
            </Text>
            {trackingTask ? (
              <TrackingCurrentJobCard
                task={trackingTask}
                currentProgress={trackingProgress}
                isJobActive={isTrackingJobActive || false}
                isJobCompleted={isTrackingJobCompleted || false}
                hasJobError={hasTrackingJobError || false}
                pendingJobsCount={pendingTrackingJobsCount}
              />
            ) : (
              <Banner>
                No tracking sync job found. Start a sync from the settings page or wait for the next auto sync.
              </Banner>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

