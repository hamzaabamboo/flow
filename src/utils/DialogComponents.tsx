import { AlertTriangle, Info } from 'lucide-react';
import { Portal } from '@ark-ui/react/portal';
import * as Dialog from '~/components/ui/styled/dialog';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { Box, HStack, VStack } from 'styled-system/jsx';

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'info';
}

interface AlertOptions {
  title?: string;
  description: string;
  confirmText?: string;
  variant?: 'danger' | 'info';
}

interface DialogComponentsProps {
  confirmDialog: {
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null;
  alertDialog: {
    options: AlertOptions;
    resolve: () => void;
  } | null;
  onConfirmClose: (confirmed: boolean) => void;
  onAlertClose: () => void;
}

export function DialogComponents({
  confirmDialog,
  alertDialog,
  onConfirmClose,
  onAlertClose
}: DialogComponentsProps) {
  return (
    <>
      {/* Confirm Dialog */}
      {confirmDialog && (
        <Dialog.Root open={true} onOpenChange={(details) => !details.open && onConfirmClose(false)}>
          <Portal>
            <Dialog.Backdrop />
            <Dialog.Positioner>
              <Dialog.Content
                borderColor="border.default"
                w={{ base: '90vw', md: '440px' }}
                maxW="440px"
                bg="bg.default"
              >
                <VStack gap="5" alignItems="flex-start" p="6">
                  <VStack gap="1" alignItems="flex-start" w="full">
                    <HStack gap="3" w="full">
                      <Box
                        data-variant={confirmDialog.options.variant || 'info'}
                        flexShrink="0"
                        color="colorPalette.default"
                      >
                        {confirmDialog.options.variant === 'danger' ? (
                          <AlertTriangle width="20" height="20" />
                        ) : (
                          <Info width="20" height="20" />
                        )}
                      </Box>
                      <Dialog.Title fontSize="lg" fontWeight="semibold" lineHeight="1.2">
                        {confirmDialog.options.title || 'Confirm Action'}
                      </Dialog.Title>
                    </HStack>

                    <Dialog.Description w="full" pl="8">
                      <Text color="fg.muted" fontSize="sm" lineHeight="1.5">
                        {confirmDialog.options.description}
                      </Text>
                    </Dialog.Description>
                  </VStack>

                  <HStack gap="3" justifyContent="flex-end" w="full" pt="2">
                    <Button variant="outline" onClick={() => onConfirmClose(false)}>
                      {confirmDialog.options.cancelText || 'Cancel'}
                    </Button>
                    <Button
                      onClick={() => onConfirmClose(true)}
                      variant="solid"
                      colorPalette={confirmDialog.options.variant === 'danger' ? 'red' : 'blue'}
                    >
                      {confirmDialog.options.confirmText || 'Confirm'}
                    </Button>
                  </HStack>
                </VStack>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      )}

      {/* Alert Dialog */}
      {alertDialog && (
        <Dialog.Root open={true} onOpenChange={(details) => !details.open && onAlertClose()}>
          <Portal>
            <Dialog.Backdrop />
            <Dialog.Positioner>
              <Dialog.Content
                borderColor="border.default"
                w={{ base: '90vw', md: '440px' }}
                maxW="440px"
                bg="bg.default"
              >
                <VStack gap="5" alignItems="flex-start" p="6">
                  <VStack gap="1" alignItems="flex-start" w="full">
                    <HStack gap="3" w="full">
                      <Box
                        data-variant={alertDialog.options.variant || 'info'}
                        flexShrink="0"
                        color="colorPalette.default"
                      >
                        {alertDialog.options.variant === 'danger' ? (
                          <AlertTriangle width="20" height="20" />
                        ) : (
                          <Info width="20" height="20" />
                        )}
                      </Box>
                      <Dialog.Title fontSize="lg" fontWeight="semibold" lineHeight="1.2">
                        {alertDialog.options.title || 'Alert'}
                      </Dialog.Title>
                    </HStack>

                    <Dialog.Description w="full" pl="8">
                      <Text color="fg.muted" fontSize="sm" lineHeight="1.5">
                        {alertDialog.options.description}
                      </Text>
                    </Dialog.Description>
                  </VStack>

                  <HStack gap="3" justifyContent="flex-end" w="full" pt="2">
                    <Button
                      onClick={onAlertClose}
                      variant="solid"
                      colorPalette={alertDialog.options.variant === 'danger' ? 'red' : 'blue'}
                    >
                      {alertDialog.options.confirmText || 'OK'}
                    </Button>
                  </HStack>
                </VStack>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      )}
    </>
  );
}
