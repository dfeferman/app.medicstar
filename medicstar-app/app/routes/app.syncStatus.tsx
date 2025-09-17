import type { LoaderFunction } from "@remix-run/node";
import {
  Banner,
  BlockStack,
  Page,
} from "@shopify/polaris";
import { useState } from "react";
import { useLoaderData } from "@remix-run/react";
import { apiTaskLoader } from "../loaders/api.task.loader";
import CurrentJobCard from "../components/CurrentJobCard";

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
  const { task, pendingJobsCount } = useLoaderData<{ task: Task | null; pendingJobsCount: number }>();

  const currentProgress = task?.processes
    ? Math.round((task.processes.filter(p => p.status === 'COMPLETED').length / task.processes.length) * 100)
    : 0;

  const isJobActive = task &&
    ['PENDING', 'PROCESSING'].includes(task.status) &&
    !task.processes.some(p => p.status === 'FAILED');

  const isJobCompleted = task &&
    task.processes.every(p => p.status === 'COMPLETED');

  const hasJobError = task &&
    task.processes.some(p => p.status === 'FAILED');

  return (
    <Page>
      <BlockStack gap="400">
        {/* Current Job Status */}
        {task ? (
          <CurrentJobCard
            task={task}
            currentProgress={currentProgress}
            isJobActive={isJobActive || false}
            isJobCompleted={isJobCompleted || false}
            hasJobError={hasJobError || false}
            pendingJobsCount={pendingJobsCount}
          />
        ) : (
          <Banner>
            No sync job found. Start a sync from the settings page.
          </Banner>
        )}
      </BlockStack>
    </Page>
  );
}

