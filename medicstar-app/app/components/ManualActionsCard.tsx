import { Card, BlockStack, Text } from "@shopify/polaris";
import { Form } from "@remix-run/react";
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

        <Form method="post">
          <input type="hidden" name="actionType" value="force-sync" />
          <ForceSyncComponent isLoading={isLoading} />
        </Form>

        <Form method="post">
          <input type="hidden" name="actionType" value="stop-pending-tasks" />
          <StopTasksComponent isLoading={isLoading} />
        </Form>
      </BlockStack>
    </Card>
  );
};

export default ManualActionsCard;
