import { Card, BlockStack, Text, Box, Button } from "@shopify/polaris";

interface ManualActionsCardProps {
  actionType: "force-sync" | "stop-pending-tasks";
  isLoading: boolean;
}

const ManualActionsCard = ({ actionType, isLoading }: ManualActionsCardProps) => {
  const isForceSync = actionType === "force-sync";

  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="300">
          <Text as="h2" variant="headingLg">
            {isForceSync ? "Force Sync" : "Stop Tasks"}
          </Text>
          <Text as="p">
            {isForceSync ? "Manually trigger an immediate product data synchronization. Use this to push urgent updates outside of the scheduled auto-sync. This doesn't require to stop auto sync." :
            "Halt all currently running or pending synchronization tasks. This can be useful if you've initiated an incorrect sync or need to stop processing."}
          </Text>
          <Box>
            <Button
              submit
              variant={isForceSync ? "primary" : "secondary"}
              tone={isForceSync ? undefined : "critical"}
              disabled={isLoading}
            >
              {isForceSync ? "Force Sync Now" : "Stop All Pending Tasks"}
            </Button>
          </Box>
        </BlockStack>
      </BlockStack>
    </Card>
  );
};

export default ManualActionsCard;
