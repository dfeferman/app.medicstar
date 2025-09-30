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

interface TrackingSyncStatusCardProps {
  trackingTask: Task | null;
  trackingProgress: number;
  isTrackingJobActive: boolean;
  isTrackingJobCompleted: boolean;
  hasTrackingJobError: boolean;
  pendingTrackingJobsCount: number;
}

const TrackingSyncStatusCard = ({
  trackingTask,
  trackingProgress,
  isTrackingJobActive,
  isTrackingJobCompleted,
  hasTrackingJobError,
  pendingTrackingJobsCount,
}: TrackingSyncStatusCardProps) => {
  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingLg">Tracking Numbers Synchronization</Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          Monitor the status of tracking number synchronization for orders.
        </Text>
        {trackingTask ? (
          <CurrentJobCard
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
  );
};

export default TrackingSyncStatusCard;
