import {
  Card,
  BlockStack,
  Text,
  TextField,
  ProgressBar,
  Banner,
  Badge
} from "@shopify/polaris";

interface Process {
  id: number;
  type: string;
  status: string;
  logMessage: string;
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

interface CurrentJobCardProps {
  task: Task;
  currentProgress: number;
  isJobActive: boolean;
  isJobCompleted: boolean;
  hasJobError: boolean;
  pendingJobsCount: number;
}

const CurrentJobCard = ({
  task,
  currentProgress,
  isJobActive,
  isJobCompleted,
  hasJobError,
  pendingJobsCount
}: CurrentJobCardProps) => {
  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingLg">
          Current Sync Task Status
        </Text>
        <Text as="p">
          This represents the current status of the sync task. Please wait until the product sync is finished. If you see an error, please check the logs for more information.
        </Text>

        {/* Job Info */}
        <BlockStack gap="300">
          <TextField
            label="Job ID:"
            value={task.id.toString()}
            disabled
            autoComplete="off"
          />
          <TextField
            label="Status:"
            value={task.status}
            disabled
            autoComplete="off"
          />
          <TextField
            label="Started At:"
            value={new Date(task.createdAt).toLocaleString()}
            disabled
            autoComplete="off"
          />
          <TextField
            label="Pending Jobs in Queue:"
            value={pendingJobsCount.toString()}
            disabled
            autoComplete="off"
          />
          {task.logMessage && (
            <TextField
              label="Logs:"
              value={task.logMessage}
              disabled
              autoComplete="off"
              multiline={4}
            />
          )}
        </BlockStack>

        {/* Progress Bar */}
        <BlockStack gap="400">
          <ProgressBar
            progress={currentProgress}
            tone={isJobCompleted ? "success" : hasJobError ? "critical" : "primary"}
            size="small"
          />

          {/* Status Messages */}
          {isJobCompleted && (
            <Banner tone="success" title="Success">
              <Text as="p">The sync is finished successfully</Text>
            </Banner>
          )}

          {isJobActive && !hasJobError && (
            <Banner title="Sync in progress">
              <Text as="p">Please wait until the product sync is finished</Text>
            </Banner>
          )}

          {hasJobError && (
            <Banner tone="critical">
              <Text as="p">Error: One or more processes failed during sync</Text>
            </Banner>
          )}
        </BlockStack>
      </BlockStack>
    </Card>
  );
};

export default CurrentJobCard;
