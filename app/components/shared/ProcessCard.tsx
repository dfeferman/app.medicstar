import { Card, BlockStack, Text, TextField } from "@shopify/polaris";

interface Process {
  id: number;
  type: string;
  status: string;
  logMessage: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ProcessCardProps {
  process: Process;
  index: number;
  typeDisplay: string;
}

const ProcessCard = ({ process, index, typeDisplay }: ProcessCardProps) => {
  return (
    <Card key={process.id}>
      <BlockStack gap="200">
        <Text as="h4" variant="headingSm">
          {index + 1}. {typeDisplay}
        </Text>
        <Text as="p" variant="bodySm" tone={process.status === 'COMPLETED' ? 'success' :
                                             process.status === 'FAILED' ? 'critical' : 'subdued'}>
          Status: {process.status}
        </Text>
        {process.logMessage && (
          <TextField
            label="Log Message:"
            value={process.logMessage}
            disabled
            autoComplete="off"
            multiline={3}
          />
        )}
        <Text as="p" variant="bodySm" tone="subdued">
          Created: {new Date(process.createdAt).toLocaleString()}
          {process.updatedAt !== process.createdAt && (
            <span> • Updated: {new Date(process.updatedAt).toLocaleString()}</span>
          )}
        </Text>
      </BlockStack>
    </Card>
  );
};

export default ProcessCard;
