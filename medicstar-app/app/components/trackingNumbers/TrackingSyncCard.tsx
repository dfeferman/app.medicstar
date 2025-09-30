import { Card, BlockStack, Text } from "@shopify/polaris";
import AutoSyncForm from "./AutoSyncForm";
import ManualActionsCard from "./ManualActionsCard";

interface TrackingSyncCardProps {
  isAutoSyncEnabled: boolean;
  isLoading: boolean;
  cronSchedule: string;
}

const TrackingSyncCard = ({ isAutoSyncEnabled, isLoading, cronSchedule }: TrackingSyncCardProps) => {
  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingLg">Tracking Numbers Sync</Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          Manage automatic and manual synchronization of tracking numbers for orders.
        </Text>
        <AutoSyncForm
          isAutoSyncEnabled={isAutoSyncEnabled}
          isLoading={isLoading}
          cronSchedule={cronSchedule}
        />
        <ManualActionsCard isLoading={isLoading} />
      </BlockStack>
    </Card>
  );
};

export default TrackingSyncCard;
