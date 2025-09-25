import { Card, BlockStack, Text, Box, Button } from "@shopify/polaris";
import { useState, useRef } from "react";
import { Form } from "@remix-run/react";
import StatusToggle from "./StatusToggle";
import ConfirmationModal from "./ConfirmationModal";
import { formatCronToUTC } from "../utils/cronFormatter";

interface TrackingAutoSyncCardProps {
  isAutoSyncEnabled: boolean;
  isLoading: boolean;
  cronSchedule: string;
}

const TrackingAutoSyncCard = ({ isAutoSyncEnabled, isLoading, cronSchedule }: TrackingAutoSyncCardProps) => {
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
      <input type="hidden" name="actionType" value="toggle-auto-sync" />
      <input type="hidden" name="syncType" value="tracking" />
      <input type="hidden" name="enabled" value={(!isAutoSyncEnabled).toString()} />

      <Card>
        <BlockStack gap="400">
          <BlockStack gap="300">
            <Text as="h2" variant="headingLg">
              Auto Settings
            </Text>
            <Text as="p">
              Automatically sync tracking numbers at {formatCronToUTC(cronSchedule)}.
            </Text>
            <Text as="p">
              Enable or disable automatic daily synchronization of tracking numbers. This ensures your Shopify orders are updated with the latest tracking information from your shipping provider. Your tracking file must be in CSV format and contain the proper tracking data structure.
            </Text>
            <Box>
              <StatusToggle
                title="Auto Sync Status"
                isEnabled={isAutoSyncEnabled}
                disabled={isLoading}
              />
            </Box>
            <Box>
              <Button
                onClick={handleButtonClick}
                variant={isAutoSyncEnabled ? "secondary" : "primary"}
                disabled={isLoading}
              >
                {isAutoSyncEnabled ? 'Disable' : 'Enable'} Auto Sync
              </Button>
            </Box>
          </BlockStack>
        </BlockStack>
      </Card>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={isAutoSyncEnabled ? "Disable Auto Sync" : "Enable Auto Sync"}
        message={isAutoSyncEnabled
          ? "Are you sure you want to disable auto synchronization? This will stop the automatic tracking number update."
          : `Are you sure you want to enable auto synchronization? This will start the automatic tracking number update at ${formatCronToUTC(cronSchedule)}.`
        }
        confirmText={isAutoSyncEnabled ? "Disable" : "Enable"}
        destructive={isAutoSyncEnabled}
        loading={isLoading}
      />
    </Form>
  );
};

export default TrackingAutoSyncCard;
