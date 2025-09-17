import { Card, BlockStack, Text, Box, Button } from "@shopify/polaris";
import StatusToggle from "./StatusToggle";

interface AutoSyncCardProps {
  isAutoSyncEnabled: boolean;
  isLoading: boolean;
}

const AutoSyncCard = ({ isAutoSyncEnabled, isLoading }: AutoSyncCardProps) => {
  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="300">
          <Text as="h2" variant="headingLg">
            Auto Sync Settings
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
              submit
              variant={isAutoSyncEnabled ? "secondary" : "primary"}
              disabled={isLoading}
            >
              {isAutoSyncEnabled ? 'Disable' : 'Enable'} Auto Sync
            </Button>
          </Box>
        </BlockStack>
      </BlockStack>
    </Card>
  );
};

export default AutoSyncCard;
