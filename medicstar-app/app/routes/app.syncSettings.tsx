import type { LoaderFunction } from "@remix-run/node";
import { useActionData, useNavigation } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Page,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useLoaderData } from "@remix-run/react";
import { settingsLoader } from "../loaders/settings.loader";
import ProductSyncCard from "../components/product/ProductSyncCard";
import TrackingSyncCard from "../components/trackingNumbers/TrackingSyncCard";

export { action } from "../actions/sync-settings.action";
export const loader: LoaderFunction = settingsLoader;
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
      <BlockStack gap="400">
         {actionData && (
          <Banner
            tone={actionData.success ? 'success' : 'critical'}
          >
            {actionData.message}
          </Banner>
        )}
        <ProductSyncCard
          isAutoSyncEnabled={productSettings.isAutoSyncEnabled}
          isLoading={isSubmitting}
          cronSchedule={cronSchedule}
        />
        <TrackingSyncCard
          isAutoSyncEnabled={trackingSettings.isAutoSyncEnabled}
          isLoading={isSubmitting}
          cronSchedule={trackingCronSchedule}
        />
      </BlockStack>
    </Page>
  );
}

