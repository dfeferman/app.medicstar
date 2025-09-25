import { Card, BlockStack, Text } from "@shopify/polaris";
import TrackingForceSyncComponent from "./TrackingForceSyncComponent";
import TrackingStopTasksComponent from "./TrackingStopTasksComponent";

interface TrackingManualActionsCardProps {
  isLoading: boolean;
}

const TrackingManualActionsCard = ({ isLoading }: TrackingManualActionsCardProps) => {
  return (
    <Card>
      <BlockStack gap="600">
        <Text as="h2" variant="headingLg">
          Manual Settings
        </Text>
        <TrackingForceSyncComponent isLoading={isLoading} />
        <TrackingStopTasksComponent isLoading={isLoading} />
      </BlockStack>
    </Card>
  );
};

export default TrackingManualActionsCard;
