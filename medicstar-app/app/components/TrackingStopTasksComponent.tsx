import { Card, BlockStack, Text, Box, Button } from "@shopify/polaris";
import { useState, useRef } from "react";
import { Form } from "@remix-run/react";
import ConfirmationModal from "./ConfirmationModal";

interface TrackingStopTasksComponentProps {
  isLoading: boolean;
}

const TrackingStopTasksComponent = ({ isLoading }: TrackingStopTasksComponentProps) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleButtonClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    setShowConfirmModal(false);
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  const handleCancel = () => {
    setShowConfirmModal(false);
  };

  return (
    <Form method="post" ref={formRef}>
      <input type="hidden" name="actionType" value="stop-pending-tasks" />
      <input type="hidden" name="syncType" value="tracking" />

      <BlockStack gap="400">
        <BlockStack gap="300">
          <Text as="h3" variant="headingMd">
            Stop Tasks
          </Text>
          <Text as="p">
            Halt all currently running or pending tracking synchronization tasks. This can be useful if you've initiated an incorrect sync or need to stop processing.
          </Text>
          <Box>
            <Button
              onClick={handleButtonClick}
              variant="secondary"
              tone="critical"
              disabled={isLoading}
            >
              Stop All Pending Tracking Tasks
            </Button>
          </Box>
        </BlockStack>
      </BlockStack>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title="Stop All Pending Tracking Tasks"
        message="Are you sure you want to stop all pending tracking synchronization tasks? This will mark all pending and processing tracking tasks as failed."
        confirmText="Stop Tracking Tasks"
        destructive={true}
        loading={isLoading}
      />
    </Form>
  );
};

export default TrackingStopTasksComponent;
