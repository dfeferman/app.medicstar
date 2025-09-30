import { Card, BlockStack, Text, Box, Button } from "@shopify/polaris";
import { useState, useRef } from "react";
import { Form } from "@remix-run/react";
import { ActionType, SyncType } from "../../constants/syncTypes";
import ConfirmationModal from "../shared/modal/ConfirmationModal";

interface TrackingForceSyncComponentProps {
  isLoading: boolean;
}

const TrackingForceSyncComponent = ({ isLoading }: TrackingForceSyncComponentProps) => {
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
      <input type="hidden" name="actionType" value={ActionType.FORCE_SYNC} />
      <input type="hidden" name="syncType" value={SyncType.TRACKING} />

      <BlockStack gap="400">
        <BlockStack gap="300">
          <Text as="h3" variant="headingMd">
            Force Sync
          </Text>
          <Text as="p">
            Manually trigger an immediate tracking number synchronization. Use this to push urgent tracking updates outside of the scheduled auto-sync. This doesn't require to stop auto sync.
          </Text>
          <Box>
            <Button
              onClick={handleButtonClick}
              variant="primary"
              disabled={isLoading}
            >
              Force Tracking Sync Now
            </Button>
          </Box>
        </BlockStack>
      </BlockStack>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title="Force Tracking Sync Now"
        message="Are you sure you want to start a manual tracking synchronization now? This will create a new task and start the tracking synchronization process."
        confirmText="Start Tracking Sync"
        loading={isLoading}
      />
    </Form>
  );
};

export default TrackingForceSyncComponent;
