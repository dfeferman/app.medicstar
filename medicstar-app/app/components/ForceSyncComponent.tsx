import { Card, BlockStack, Text, Box, Button } from "@shopify/polaris";

interface ForceSyncComponentProps {
  isLoading: boolean;
}

const ForceSyncComponent = ({ isLoading }: ForceSyncComponentProps) => {
  return (
    // <Card>
      <BlockStack gap="400">
        <BlockStack gap="300">
          <Text as="h3" variant="headingMd">
            Force Sync
          </Text>
          <Text as="p">
            Manually trigger an immediate product data synchronization. Use this to push urgent updates outside of the scheduled auto-sync. This doesn't require to stop auto sync.
          </Text>
          <Box>
            <Button
              submit
              variant="primary"
              disabled={isLoading}
            >
              Force Sync Now
            </Button>
          </Box>
        </BlockStack>
      </BlockStack>
    // </Card>
  );
};

export default ForceSyncComponent;
