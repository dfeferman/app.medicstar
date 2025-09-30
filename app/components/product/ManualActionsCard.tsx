import { Card, BlockStack, Text, Box } from "@shopify/polaris";
import ForceSyncComponent from "./ForceSyncForm";
import StopTasksComponent from "./StopTasksForm";

interface ManualActionsCardProps {
  isLoading: boolean;
}

const ManualActionsCard = ({ isLoading }: ManualActionsCardProps) => {
  return (
    // <Card>
    <Box paddingBlock="200">
      <BlockStack gap="600">
        <Text as="h2" variant="headingLg">
          Manual Settings
        </Text>
        <ForceSyncComponent isLoading={isLoading} />
        <StopTasksComponent isLoading={isLoading} />
      </BlockStack>
      </Box>
    // </Card>
  );
};

export default ManualActionsCard;
