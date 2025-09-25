import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { useActionData, useNavigation } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Page,
  Text,
  InlineStack,
  Card,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useLoaderData } from "@remix-run/react";
import { settingsLoader } from "../loaders/settings.loader";
import AutoSyncCard from "../components/AutoSyncCard";
import ManualActionsCard from "../components/ManualActionsCard";
import TrackingAutoSyncCard from "../components/TrackingAutoSyncCard";
import TrackingManualActionsCard from "../components/TrackingManualActionsCard";

// Export the single action
export { action } from "../actions/sync-settings.action";

interface Settings {
  id: number;
  shopId: number;
  isAutoSyncEnabled: boolean;
  isStopAllPendingTasks: boolean;
  isForceSyncEnabled: boolean;
  jobType: string;
  createdAt: string;
  updatedAt: string;
}

export const loader: LoaderFunction = settingsLoader;

export default function SyncSettingsPage() {
  const { productSettings, trackingSettings, cronSchedule, trackingCronSchedule } = useLoaderData<{
    productSettings: Settings;
    trackingSettings: Settings;
    cronSchedule: string;
    trackingCronSchedule: string;
  }>();
  const actionData = useActionData<{ success: boolean; message: string }>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  return (
    <Page>
      <TitleBar title="Sync Settings" />
      <BlockStack gap="600">
        {/* Product Sync Section */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">Product Sync</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Manage automatic and manual synchronization of product data including prices and inventory quantities.
            </Text>
            <AutoSyncCard
              isAutoSyncEnabled={productSettings.isAutoSyncEnabled}
              isLoading={isSubmitting}
              cronSchedule={cronSchedule}
            />
            <ManualActionsCard isLoading={isSubmitting} />
          </BlockStack>
        </Card>


        {/* Tracking Sync Section */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">Tracking Numbers Sync</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Manage automatic and manual synchronization of tracking numbers for orders.
            </Text>
            <TrackingAutoSyncCard
              isAutoSyncEnabled={trackingSettings.isAutoSyncEnabled}
              isLoading={isSubmitting}
              cronSchedule={trackingCronSchedule}
            />
            <TrackingManualActionsCard isLoading={isSubmitting} />
          </BlockStack>
        </Card>

        {actionData && (
          <Banner
            tone={actionData.success ? 'success' : 'critical'}
          >
            {actionData.message}
          </Banner>
        )}
      </BlockStack>
    </Page>
  );
}

