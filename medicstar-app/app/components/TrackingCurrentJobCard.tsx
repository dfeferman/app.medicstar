import {
  Card,
  BlockStack,
  Text,
  TextField,
  ProgressBar,
  Banner,
} from "@shopify/polaris";
import ProcessLogsSection from "./ProcessLogsSection";

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

interface TrackingCurrentJobCardProps {
  task: Task;
  currentProgress: number;
  isJobActive: boolean;
  isJobCompleted: boolean;
  hasJobError: boolean;
  pendingJobsCount: number;
}

const TrackingCurrentJobCard = ({
  task,
  currentProgress,
  isJobActive,
  isJobCompleted,
  hasJobError,
  pendingJobsCount
}: TrackingCurrentJobCardProps) => {
  // Get current active process
  const currentProcess = task.processes.find(p => p.status === 'PROCESSING') ||
                        task.processes.find(p => p.status === 'PENDING');

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingLg">
          Tracking Numbers Sync Status
        </Text>
        <Text as="p">
          This represents the current status of the tracking sync task. Please wait until the tracking sync is finished. If you see an error, please check the logs for more information.
        </Text>

        <BlockStack gap="300">
          <TextField
            label="Task ID:"
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
          {currentProcess && (
            <TextField
              label="Current Process:"
              value={currentProcess.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
              disabled
              autoComplete="off"
            />
          )}
          {task.logMessage && (
            <TextField
              label="Task Logs:"
              value={task.logMessage}
              disabled
              autoComplete="off"
              multiline={4}
            />
          )}
        </BlockStack>

        <BlockStack gap="400">
          <ProgressBar
            progress={currentProgress}
            tone={isJobCompleted ? "success" : hasJobError ? "critical" : "primary"}
            size="small"
          />

          {/* Process Logs Section */}
          <ProcessLogsSection processes={task.processes} />

          {isJobCompleted && (
            <Banner tone="success" title="Success">
              <Text as="p">The tracking sync is finished successfully</Text>
            </Banner>
          )}

          {isJobActive && !hasJobError && (
            <Banner title="Sync in progress">
              <Text as="p">Please wait until the tracking sync is finished</Text>
            </Banner>
          )}

          {hasJobError && (
            <Banner tone="critical">
              <Text as="p">Error: One or more processes failed during tracking sync</Text>
            </Banner>
          )}
        </BlockStack>
      </BlockStack>
    </Card>
  );
};

export default TrackingCurrentJobCard;
