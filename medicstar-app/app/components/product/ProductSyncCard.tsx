import { Card, BlockStack, Text } from "@shopify/polaris";
import AutoSyncForm from "./AutoSyncForm";
import ManualActionsCard from "./ManualActionsCard";

interface ProductSyncCardProps {
  isAutoSyncEnabled: boolean;
  isLoading: boolean;
  cronSchedule: string;
}

const ProductSyncCard = ({ isAutoSyncEnabled, isLoading, cronSchedule }: ProductSyncCardProps) => {
  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingLg">Product Sync</Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          Manage automatic and manual synchronization of product data including prices and inventory quantities.
        </Text>
        <AutoSyncForm
          isAutoSyncEnabled={isAutoSyncEnabled}
          isLoading={isLoading}
          cronSchedule={cronSchedule}
        />
        <ManualActionsCard isLoading={isLoading} />
      </BlockStack>
    </Card>
  );
};

export default ProductSyncCard;
