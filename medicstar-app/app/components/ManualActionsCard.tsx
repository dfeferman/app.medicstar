import { Card, BlockStack, Text } from "@shopify/polaris";
import ForceSyncComponent from "./ForceSyncComponent";
import StopTasksComponent from "./StopTasksComponent";

interface ManualActionsCardProps {
  isLoading: boolean;
}

const ManualActionsCard = ({ isLoading }: ManualActionsCardProps) => {
  return (
    <Card>
      <BlockStack gap="600">
        <Text as="h2" variant="headingLg">
          Manual Settings
        </Text>
        <ForceSyncComponent isLoading={isLoading} />
        <StopTasksComponent isLoading={isLoading} />
      </BlockStack>
    </Card>
  );
};

export default ManualActionsCard;
