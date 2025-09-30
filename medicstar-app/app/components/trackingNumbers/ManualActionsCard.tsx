import { Card, Box, BlockStack, Text } from "@shopify/polaris";
import TrackingForceSyncComponent from "./ForceSyncForm";
import TrackingStopTasksComponent from "./StopTasksForm";

interface TrackingManualActionsCardProps {
  isLoading: boolean;
}

const TrackingManualActionsCard = ({ isLoading }: TrackingManualActionsCardProps) => {
  return (
    // <Card>
    <Box paddingBlock="200">
      <BlockStack gap="600">
        <Text as="h2" variant="headingLg">
          Manual Settings
        </Text>
        <TrackingForceSyncComponent isLoading={isLoading} />
        <TrackingStopTasksComponent isLoading={isLoading} />
      </BlockStack>
    </Box>
    // </Card>
  );
};

export default TrackingManualActionsCard;
