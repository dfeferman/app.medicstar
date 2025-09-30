import type { LoaderFunction } from "@remix-run/node";
import {
  BlockStack,
  Page,
} from "@shopify/polaris";
import { useLoaderData } from "@remix-run/react";
import { apiTaskLoader } from "../loaders/api.task.loader";
import ProductSyncStatusCard from "../components/product/ProductSyncStatusCard";
import TrackingSyncStatusCard from "../components/trackingNumbers/TrackingSyncStatusCard";
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

  const productProgress = productTask?.processes
    ? Math.round((productTask.processes.filter(p => p.status === 'COMPLETED').length / productTask.processes.length) * 100)
    : 0;

  const trackingProgress = trackingTask?.processes
    ? Math.round((trackingTask.processes.filter(p => p.status === 'COMPLETED').length / trackingTask.processes.length) * 100)
    : 0;

  const isProductJobActive = productTask &&
    ['PENDING', 'PROCESSING'].includes(productTask.status) &&
    !productTask.processes.some(p => p.status === 'FAILED');

  const isProductJobCompleted = productTask && (productTask.status === 'COMPLETED');

  const hasProductJobError = productTask &&
    (productTask.status === 'FAILED' || productTask.processes.some(p => p.status === 'FAILED'));

  const isTrackingJobActive = trackingTask &&
    ['PENDING', 'PROCESSING'].includes(trackingTask.status) &&
    !trackingTask.processes.some(p => p.status === 'FAILED');

  const isTrackingJobCompleted = trackingTask && (trackingTask.status === 'COMPLETED');

  const hasTrackingJobError = trackingTask &&
    (trackingTask.status === 'FAILED' || trackingTask.processes.some(p => p.status === 'FAILED'));

  return (
    <Page>
      <TitleBar title="Synchronization Status" />
      <BlockStack gap="600">
        <ProductSyncStatusCard
          productTask={productTask}
          productProgress={productProgress}
          isProductJobActive={isProductJobActive || false}
          isProductJobCompleted={isProductJobCompleted || false}
          hasProductJobError={hasProductJobError || false}
          pendingProductJobsCount={pendingProductJobsCount}
        />
        <TrackingSyncStatusCard
          trackingTask={trackingTask}
          trackingProgress={trackingProgress}
          isTrackingJobActive={isTrackingJobActive || false}
          isTrackingJobCompleted={isTrackingJobCompleted || false}
          hasTrackingJobError={hasTrackingJobError || false}
          pendingTrackingJobsCount={pendingTrackingJobsCount}
        />
      </BlockStack>
    </Page>
  );
}

