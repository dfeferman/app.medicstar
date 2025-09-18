import { Card, BlockStack, Text, Box, Button } from "@shopify/polaris";
import { useState, useRef } from "react";
import { Form } from "@remix-run/react";
import ConfirmationModal from "./ConfirmationModal";

interface ForceSyncComponentProps {
  isLoading: boolean;
}

const ForceSyncComponent = ({ isLoading }: ForceSyncComponentProps) => {
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
    <Form method="post" data-action="force-sync" ref={formRef}>
      <input type="hidden" name="actionType" value="force-sync" />

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
              onClick={handleButtonClick}
              variant="primary"
              disabled={isLoading}
            >
              Force Sync Now
            </Button>
          </Box>
        </BlockStack>
      </BlockStack>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title="Force Sync Now"
        message="Are you sure you want to start a manual synchronization now? This will create a new task and start the synchronization process."
        confirmText="Start Sync"
        loading={isLoading}
      />
    </Form>
  );
};

export default ForceSyncComponent;
