import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Page,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useLoaderData } from "@remix-run/react";
import { settingsLoader } from "../loaders/settings.loader";
import AutoSyncCard from "../components/AutoSyncCard";
import ManualActionsCard from "../components/ManualActionsCard";

export { action } from "../actions/start-product-sync.action";

interface Settings {
  id: number;
  shopId: number;
  isAutoSyncEnabled: boolean;
  isStopAllPendingTasks: boolean;
  isForceSyncEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const loader: LoaderFunction = settingsLoader;

export default function SyncSettingsPage() {
  const { settings } = useLoaderData<{ settings: Settings }>();
  const actionData = useActionData<{ success: boolean; message: string }>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  return (
    <Page>
      <TitleBar title="Settings">
      </TitleBar>
      <BlockStack gap="400">
        <Form method="post">
          <input type="hidden" name="actionType" value="toggle-auto-sync" />
          <input type="hidden" name="enabled" value={(!settings.isAutoSyncEnabled).toString()} />
          <AutoSyncCard
            isAutoSyncEnabled={settings.isAutoSyncEnabled}
            isLoading={isSubmitting}
          />
        </Form>

        <ManualActionsCard isLoading={isSubmitting} />

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

