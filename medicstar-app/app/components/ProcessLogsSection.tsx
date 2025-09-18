import {
  BlockStack,
  Text,
  TextField,
  Collapsible,
  Button,
  Card,
} from "@shopify/polaris";
import { useState } from "react";

interface Process {
  id: number;
  type: string;
  status: string;
  logMessage: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ProcessLogsSectionProps {
  processes: Process[];
}

const ProcessLogsSection = ({ processes }: ProcessLogsSectionProps) => {
  const [showProcessLogs, setShowProcessLogs] = useState(false);

  const processLogs = processes.map(process => ({
    ...process,
    typeDisplay: process.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }));

  return (
    <BlockStack gap="300">
      <Button
        onClick={() => setShowProcessLogs(!showProcessLogs)}
        variant="tertiary"
        size="slim"
      >
        {showProcessLogs ? 'Hide' : 'Show'} Process Logs ({processLogs.length.toString()})
      </Button>

      <Collapsible
        open={showProcessLogs}
        id="process-logs-collapsible"
        transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}
      >
        <BlockStack gap="300">
          {processLogs.map((process, index) => (
            <Card key={process.id}>
              <BlockStack gap="200">
                <Text as="h4" variant="headingSm">
                  {index + 1}. {process.typeDisplay}
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
          ))}
        </BlockStack>
      </Collapsible>
    </BlockStack>
  );
};

export default ProcessLogsSection;
