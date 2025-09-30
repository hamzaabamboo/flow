import React from 'react';
import { X, Plus, Edit } from 'lucide-react';
import { Portal } from '@ark-ui/react/portal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { IconButton } from '../ui/icon-button';
import * as Dialog from '../ui/styled/dialog';
import { Text } from '../ui/text';
import { Box, VStack, HStack } from 'styled-system/jsx';

interface ColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  mode: 'create' | 'edit';
  columnName?: string;
  columnId?: string;
}

export function ColumnDialog({
  open,
  onOpenChange,
  onSubmit,
  mode,
  columnName,
  columnId
}: ColumnDialogProps) {
  const isEdit = mode === 'edit';

  return (
    <Dialog.Root open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="500px">
            <VStack gap="6" p="6">
              <VStack gap="1">
                <Dialog.Title>{isEdit ? 'Edit Column' : 'Create New Column'}</Dialog.Title>
                <Dialog.Description>
                  {isEdit ? 'Update the column name' : 'Enter a name for the new column'}
                </Dialog.Description>
              </VStack>

              <form id="column-form" onSubmit={onSubmit} style={{ width: '100%' }}>
                <VStack gap="4">
                  {isEdit && <input type="hidden" name="columnId" value={columnId} />}

                  <Box w="full">
                    <Text mb="1" fontSize="sm" fontWeight="medium">
                      Column Name
                    </Text>
                    <Input
                      name="name"
                      defaultValue={columnName}
                      placeholder="Enter column name"
                      required
                    />
                  </Box>

                  {!isEdit && (
                    <Box w="full">
                      <Text mb="1" fontSize="sm" fontWeight="medium">
                        WIP Limit (optional)
                      </Text>
                      <Input
                        name="wipLimit"
                        type="number"
                        placeholder="Work-in-progress limit"
                        min="0"
                      />
                      <Text mt="1" color="fg.muted" fontSize="xs">
                        Limit the number of tasks that can be in this column
                      </Text>
                    </Box>
                  )}
                </VStack>
              </form>

              <Box borderColor="border.default" borderTopWidth="1px" w="full" mt="4" pt="4">
                <HStack gap="3" justifyContent="flex-end" width="full">
                  <Dialog.CloseTrigger asChild>
                    <Button variant="ghost" type="button">
                      Cancel
                    </Button>
                  </Dialog.CloseTrigger>
                  <Button type="submit" variant="solid" form="column-form" size="md">
                    {isEdit ? (
                      <>
                        <Edit size={16} />
                        Update Column
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        Create Column
                      </>
                    )}
                  </Button>
                </HStack>
              </Box>
            </VStack>

            <Dialog.CloseTrigger asChild position="absolute" top="2" right="2">
              <IconButton aria-label="Close Dialog" variant="ghost" size="sm">
                <X />
              </IconButton>
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

export default ColumnDialog;
