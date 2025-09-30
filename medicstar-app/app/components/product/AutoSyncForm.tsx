import { Card, BlockStack, Text, Box, Button, InlineGrid } from "@shopify/polaris";
import { useState, useRef } from "react";
import { Form } from "@remix-run/react";
import StatusToggle from "../shared/StatusToggle";
import ConfirmationModal from "../shared/modal/ConfirmationModal";
import { formatCronToUTC } from "../../utils/cronFormatter";
import { ActionType, SyncType } from "../../constants/syncTypes";

interface AutoSyncCardProps {
  isAutoSyncEnabled: boolean;
  isLoading: boolean;
  cronSchedule: string;
}

const AutoSyncCard = ({ isAutoSyncEnabled, isLoading, cronSchedule }: AutoSyncCardProps) => {
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
      <input type="hidden" name="actionType" value={ActionType.TOGGLE_AUTO_SYNC} />
      <input type="hidden" name="syncType" value={SyncType.PRODUCT} />
      <input type="hidden" name="enabled" value={(!isAutoSyncEnabled).toString()} />

      {/* <Card> */}
      <Box paddingBlock="200">
        <BlockStack gap="400">
          <BlockStack gap="300">
            <Text as="h2" variant="headingLg">
              Auto Settings
            </Text>
            <Text as="p">
              Automatically sync products at {formatCronToUTC(cronSchedule)}.
            </Text>
            <Text as="p">
              Enable or disable automatic daily synchronization of the product data. This ensures your Shopify store's prices and quantities are always up-to-date. Your update file must be in .xlsx format and contain the following columns: Produktnummer (SKU), Lagerbestand (Quantity), and EK Netto (Price).
            </Text>
            <InlineGrid columns={["oneThird", "twoThirds" ]} alignItems="center">
            <Box>
              <Button
                onClick={handleButtonClick}
                variant={isAutoSyncEnabled ? "secondary" : "primary"}
                disabled={isLoading}
              >
                {isAutoSyncEnabled ? 'Disable' : 'Enable'} Auto Sync
              </Button>
            </Box>
            <Box >
              <StatusToggle
                title="Auto Sync Status"
                isEnabled={isAutoSyncEnabled}
                disabled={isLoading}
              />
            </Box>
            </InlineGrid>
          </BlockStack>
        </BlockStack>
      </Box>
      {/* </Card> */}

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={isAutoSyncEnabled ? "Disable Auto Sync" : "Enable Auto Sync"}
        message={isAutoSyncEnabled
          ? "Are you sure you want to disable auto synchronization? This will stop the automatic product update."
          : `Are you sure you want to enable auto synchronization? This will start the automatic product update at ${formatCronToUTC(cronSchedule)}.`
        }
        confirmText={isAutoSyncEnabled ? "Disable" : "Enable"}
        destructive={isAutoSyncEnabled}
        loading={isLoading}
      />
    </Form>
  );
};

export default AutoSyncCard;
