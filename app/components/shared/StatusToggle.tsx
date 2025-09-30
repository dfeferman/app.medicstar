import { Badge, Box, Button, ButtonGroup, InlineGrid, InlineStack, Text } from "@shopify/polaris";
import { useCallback, type FC } from "react";

export enum BadgeTone {
  SUCCESS = "success",
  CRITICAL = "critical",
}

export enum BadgeText {
  ON = "On",
  OFF = "Off",
}

export interface StatusToggleProps {
  title: string;
  isEnabled: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}

const StatusToggle: FC<StatusToggleProps> = ({
  title,
  isEnabled,
  onToggle,
  disabled = false,
}) => {
  const badgeTone = isEnabled ? BadgeTone.SUCCESS : BadgeTone.CRITICAL;
  const badgeText = isEnabled ? BadgeText.ON : BadgeText.OFF;

  const handleButtonClick = useCallback(
    (index: number) => {
      if (disabled || !onToggle) return;

      if ((index === 0 && !isEnabled) || (index === 1 && isEnabled)) return;

      onToggle();
    },
    [isEnabled, onToggle, disabled],
  );

  return (
    <Box width="40%" borderColor="border" borderWidth="025" borderRadius="100" padding="200">
      <InlineGrid columns={["oneHalf", "oneHalf" ]} alignItems="center">
        <Text as="p">{title}</Text>
        <InlineStack align="end">
          <Badge tone={badgeTone}>{badgeText}</Badge>
        </InlineStack>
      </InlineGrid>
      {onToggle && (
        <Box>
          <ButtonGroup variant="segmented">
            <Button
              pressed={!isEnabled}
              onClick={() => handleButtonClick(0)}
              disabled={disabled}
            >
              Disabled
            </Button>
            <Button
              pressed={isEnabled}
              onClick={() => handleButtonClick(1)}
              disabled={disabled}
            >
              Enabled
            </Button>
          </ButtonGroup>
        </Box>
      )}
    </Box>
  );
};

export default StatusToggle;
