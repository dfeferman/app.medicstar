import { Card, BlockStack, Text, Box, Button } from "@shopify/polaris";
import { useState, useRef } from "react";
import { Form } from "@remix-run/react";
import StatusToggle from "./StatusToggle";
import ConfirmationModal from "./ConfirmationModal";

interface AutoSyncCardProps {
  isAutoSyncEnabled: boolean;
  isLoading: boolean;
}

const AutoSyncCard = ({ isAutoSyncEnabled, isLoading }: AutoSyncCardProps) => {
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
    <Form method="post" data-action="auto-sync" ref={formRef}>
      <input type="hidden" name="actionType" value="toggle-auto-sync" />
      <input type="hidden" name="enabled" value={(!isAutoSyncEnabled).toString()} />

      <Card>
        <BlockStack gap="400">
          <BlockStack gap="300">
            <Text as="h2" variant="headingLg">
              Auto Settings
            </Text>
            <Text as="p">
              Automatically sync products daily at 00:00 UTC.
            </Text>
            <Text as="p">
              Enable or disable automatic daily synchronization of the product data. This ensures your Shopify store's prices and quantities are always up-to-date. Your update file must be in .xlsx format and contain the following columns: Produktnummer (SKU), Lagerbestand (Quantity), and EK Netto (Price).
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
          ? "Are you sure you want to disable auto synchronization? This will stop the automatic product update."
          : "Are you sure you want to enable auto synchronization? This will start the automatic product update daily at 00:00 UTC."
        }
        confirmText={isAutoSyncEnabled ? "Disable" : "Enable"}
        destructive={isAutoSyncEnabled}
        loading={isLoading}
      />
    </Form>
  );
};

export default AutoSyncCard;
