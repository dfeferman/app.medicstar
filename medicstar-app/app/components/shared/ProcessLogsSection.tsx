import {
  BlockStack,
  Text,
  Collapsible,
  Button,
} from "@shopify/polaris";
import { useState } from "react";
import ProcessCard from "./ProcessCard";

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
            <ProcessCard
              key={process.id}
              process={process}
              index={index}
              typeDisplay={process.typeDisplay}
            />
          ))}
        </BlockStack>
      </Collapsible>
    </BlockStack>
  );
};

export default ProcessLogsSection;
