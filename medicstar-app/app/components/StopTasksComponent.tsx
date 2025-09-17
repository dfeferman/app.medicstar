import { Card, BlockStack, Text, Box, Button } from "@shopify/polaris";

interface StopTasksComponentProps {
  isLoading: boolean;
}

const StopTasksComponent = ({ isLoading }: StopTasksComponentProps) => {
  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="300">
          <Text as="h3" variant="headingMd">
            Stop Tasks
          </Text>
          <Text as="p">
            Halt all currently running or pending synchronization tasks. This can be useful if you've initiated an incorrect sync or need to stop processing.
          </Text>
          <Box>
            <Button
              submit
              variant="secondary"
              tone="critical"
              disabled={isLoading}
            >
              Stop All Pending Tasks
            </Button>
          </Box>
        </BlockStack>
      </BlockStack>
    </Card>
  );
};

export default StopTasksComponent;
