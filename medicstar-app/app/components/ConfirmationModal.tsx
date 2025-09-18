import { Modal, Text, BlockStack, Button } from "@shopify/polaris";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  loading?: boolean;
}

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  loading = false,
}: ConfirmationModalProps) => {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={title}
      primaryAction={{
        content: confirmText,
        onAction: onConfirm,
        destructive,
        loading,
      }}
      secondaryActions={[
        {
          content: cancelText,
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Text as="p">{message}</Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
};

export default ConfirmationModal;
