import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Portal } from '@ark-ui/react/portal';
import { useSpace } from '../contexts/SpaceContext';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { Box, VStack, HStack } from 'styled-system/jsx';
import { createListCollection, Select } from './ui/select';
import * as Dialog from './ui/styled/dialog';
import type { Column, CalendarEvent, ExtendedTask, Task } from '@hamflow/shared';

interface MoveTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: CalendarEvent | ExtendedTask | Task | null;
  onMove: (taskId: string, columnId: string) => void;
  isMoving?: boolean;
}

export function MoveTaskDialog({
  open,
  onOpenChange,
  task,
  onMove,
  isMoving
}: MoveTaskDialogProps) {
  const { currentSpace } = useSpace();
  const [selectedTargetBoardId, setSelectedTargetBoardId] = useState<string>('');
  const [selectedTargetColumnId, setSelectedTargetColumnId] = useState<string>('');

  // Fetch boards for move options
  const { data: boards = [] } = useQuery<Array<{ id: string; name: string; columns: Column[] }>>({
    queryKey: ['boards', currentSpace],
    queryFn: async () => {
      const response = await fetch(`/api/boards?space=${currentSpace}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch boards');
      return response.json();
    }
  });

  // Set initial board/column when task changes
  useEffect(() => {
    if (task && 'boardId' in task && task.boardId) {
      setSelectedTargetBoardId(task.boardId);
      if ('columnId' in task && task.columnId) {
        setSelectedTargetColumnId(task.columnId);
      }
    }
  }, [task]);

  const handleMove = () => {
    if (task && selectedTargetColumnId) {
      onMove(task.id, selectedTargetColumnId);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="500px">
          <VStack gap="6" alignItems="stretch" p="6">
            <VStack gap="1" alignItems="stretch">
              <Dialog.Title>Move Task</Dialog.Title>
              <Dialog.Description>
                Move "{task?.title}" to a different board or column
              </Dialog.Description>
            </VStack>

            <VStack gap="4" alignItems="stretch">
              <Box>
                <Text mb="2" fontWeight="medium">
                  Board
                </Text>
                <Select.Root
                  collection={createListCollection({
                    items: boards.map((b) => ({ label: b.name, value: b.id }))
                  })}
                  value={selectedTargetBoardId ? [selectedTargetBoardId] : []}
                  onValueChange={(details) => {
                    const newBoardId = details.value[0];
                    setSelectedTargetBoardId(newBoardId);
                    // Auto-select first column of new board
                    const board = boards.find((b) => b.id === newBoardId);
                    if (board && board.columns.length > 0) {
                      setSelectedTargetColumnId(board.columns[0].id);
                    }
                  }}
                >
                  <Select.Trigger>
                    <Select.ValueText placeholder="Select board" />
                  </Select.Trigger>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        {boards.map((board) => (
                          <Select.Item key={board.id} item={{ label: board.name, value: board.id }}>
                            {board.name}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>
              </Box>

              {selectedTargetBoardId && (
                <Box>
                  <Text mb="2" fontWeight="medium">
                    Column
                  </Text>
                  <Select.Root
                    collection={createListCollection({
                      items:
                        boards
                          .find((b) => b.id === selectedTargetBoardId)
                          ?.columns.map((c) => ({ label: c.name, value: c.id })) || []
                    })}
                    value={selectedTargetColumnId ? [selectedTargetColumnId] : []}
                    onValueChange={(details) => setSelectedTargetColumnId(details.value[0])}
                  >
                    <Select.Trigger>
                      <Select.ValueText placeholder="Select column" />
                    </Select.Trigger>
                    <Portal>
                      <Select.Positioner>
                        <Select.Content>
                          {boards
                            .find((b) => b.id === selectedTargetBoardId)
                            ?.columns.map((column) => (
                              <Select.Item
                                key={column.id}
                                item={{ label: column.name, value: column.id }}
                              >
                                {column.name}
                              </Select.Item>
                            ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Portal>
                  </Select.Root>
                </Box>
              )}
            </VStack>

            <HStack gap="3" justifyContent="flex-end">
              <Dialog.CloseTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.CloseTrigger>
              <Button
                variant="solid"
                onClick={handleMove}
                disabled={!selectedTargetColumnId || isMoving}
                loading={isMoving}
              >
                Move Task
              </Button>
            </HStack>
          </VStack>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
