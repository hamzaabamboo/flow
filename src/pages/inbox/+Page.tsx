import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Bot, Mail, FileText, PartyPopper, Trash2, ArrowRight } from 'lucide-react';
import { navigate } from 'vike/client/router';
import { useSpace } from '../../contexts/SpaceContext';
import { useToaster } from '../../contexts/ToasterContext';
import { useDialogs } from '../../utils/useDialogs';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/ui/icon-button';
import * as Card from '../../components/ui/styled/card';
import { Checkbox } from '../../components/ui/checkbox';
import { Text } from '../../components/ui/text';
import { Heading } from '../../components/ui/heading';
import * as Dialog from '../../components/ui/styled/dialog';
import type { InboxItem } from '../../shared/types/misc';
import type { BoardWithColumns } from '../../shared/types/board';
import { Spinner } from '../../components/ui/spinner';
import { VStack, HStack, Box, Grid } from 'styled-system/jsx';
import { css } from 'styled-system/css';
import { api } from '../../api/client';

const getSourceIcon = (source: string | null) => {
  switch (source) {
    case 'command':
      return <MessageCircle width="16" height="16" />;
    case 'hambot':
      return <Bot width="16" height="16" />;
    case 'email':
      return <Mail width="16" height="16" />;
    default:
      return <FileText width="16" height="16" />;
  }
};

export default function InboxPage() {
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();
  const { toast } = useToaster();
  const { confirm } = useDialogs();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [pendingItems, setPendingItems] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>('');

  // Fetch inbox items
  const { data: items, isLoading } = useQuery<InboxItem[]>({
    queryKey: ['inbox', currentSpace],
    queryFn: async () => {
      const { data, error } = await api.api.inbox.get({ query: { space: currentSpace } });
      if (error) throw new Error('Failed to fetch inbox items');
      return data as InboxItem[];
    }
  });

  // Fetch boards for selection
  const { data: boards } = useQuery<BoardWithColumns[]>({
    queryKey: ['boards', currentSpace],
    queryFn: async () => {
      const { data, error } = await api.api.boards.get({ query: { space: currentSpace } });
      if (error) throw new Error('Failed to fetch boards');
      return data as BoardWithColumns[];
    }
  });

  // Get all columns from all boards for selection
  const allColumns =
    boards?.flatMap((board: BoardWithColumns) =>
      board.columns.map((col) => ({
        id: col.id,
        name: col.name,
        boardName: board.name
      }))
    ) || [];

  // Convert to task mutation
  const convertToTask = useMutation({
    mutationFn: async ({ itemId, columnId }: { itemId: string; columnId: string }) => {
      const { data, error } = await api.api.inbox.convert.post({ itemId, columnId });
      if (error) throw new Error('Failed to convert item');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox', currentSpace] });
      queryClient.invalidateQueries({ queryKey: ['boards', currentSpace] });
      toast?.('Item converted to task', { type: 'success' });
      setSelectedItems(new Set());
    },
    onError: () => {
      toast?.('Failed to convert item', { type: 'error' });
    }
  });

  // Delete items mutation
  const deleteItems = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const { data, error } = await api.api.inbox.delete.post({ itemIds });
      if (error) throw new Error('Failed to delete items');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox', currentSpace] });
      toast?.('Items deleted', { type: 'success' });
      setSelectedItems(new Set());
    },
    onError: () => {
      toast?.('Failed to delete items', { type: 'error' });
    }
  });

  const openDestinationModal = (itemId?: string) => {
    const itemsToConvert = itemId ? [itemId] : Array.from(selectedItems);

    if (allColumns.length === 0) {
      toast?.('No boards available. Please create a board first', { type: 'error' });
      return;
    }

    setPendingItems(itemsToConvert);

    // Pre-select "To Do" column if available
    const todoColumn = allColumns.find(
      (col) => col.name.toLowerCase() === 'to do' || col.name.toLowerCase() === 'todo'
    );
    setSelectedColumn(todoColumn?.id || allColumns[0].id);

    setShowDestinationModal(true);
  };

  const handleConfirmConvert = async () => {
    if (!selectedColumn) {
      toast?.('Please select a destination', { type: 'error' });
      return;
    }

    // Find the board ID for navigation
    const selectedBoardId = boards?.find((board: BoardWithColumns) =>
      board.columns.some((col) => col.id === selectedColumn)
    )?.id;

    pendingItems.forEach((itemId) => {
      convertToTask.mutate({ itemId, columnId: selectedColumn });
    });

    setShowDestinationModal(false);
    setPendingItems([]);

    // Navigate to the board
    if (selectedBoardId) {
      await navigate(`/board/${selectedBoardId}`);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  if (isLoading) {
    return (
      <VStack gap="3" justifyContent="center" alignItems="center" minH="60vh" p="8">
        <Spinner size="lg" />
        <Text color="fg.muted">Loading inbox...</Text>
      </VStack>
    );
  }

  return (
    <Box data-space={currentSpace} p="6">
      <VStack gap="6" alignItems="stretch">
        <HStack justifyContent="space-between" alignItems="center">
          <VStack gap="1" alignItems="start">
            <Heading size="2xl">Inbox</Heading>
            <Text color="fg.muted">Process and organize your incoming items</Text>
          </VStack>

          {selectedItems.size > 0 && (
            <HStack gap="2">
              <Button onClick={() => openDestinationModal()} variant="solid" size="sm">
                <ArrowRight width="16" height="16" />
                Move to Board ({selectedItems.size})
              </Button>

              <Button
                onClick={() => {
                  void (async () => {
                    const confirmed = await confirm({
                      title: 'Delete Items',
                      description: `Are you sure you want to delete ${selectedItems.size} item(s)? This action cannot be undone.`,
                      confirmText: 'Delete',
                      variant: 'danger'
                    });
                    if (confirmed) {
                      deleteItems.mutate(Array.from(selectedItems));
                    }
                  })();
                }}
                variant="outline"
                size="sm"
                colorPalette="red"
              >
                <Trash2 width="16" height="16" />
                Delete ({selectedItems.size})
              </Button>
            </HStack>
          )}
        </HStack>

        {!items || items.length === 0 ? (
          <Card.Root width="full" textAlign="center">
            <Card.Header>
              <Card.Title>
                <HStack gap="2" justifyContent="center">
                  <Text>Your inbox is empty!</Text>
                  <PartyPopper width="20" height="20" />
                </HStack>
              </Card.Title>
              <Card.Description>
                New items will appear here when you use the command bar or receive messages
              </Card.Description>
            </Card.Header>
            <Card.Body py="8">
              <Text color="fg.muted" fontSize="sm">
                No pending items in your {currentSpace} inbox
              </Text>
            </Card.Body>
          </Card.Root>
        ) : (
          <VStack gap="2">
            {items.map((item: InboxItem) => (
              <HStack
                key={item.id}
                onClick={() => toggleItemSelection(item.id)}
                cursor="pointer"
                gap="3"
                alignItems="center"
                data-selected={selectedItems.has(item.id)}
                className={css({
                  borderColor: 'border.default',
                  bg: 'bg.default',
                  transition: 'all 0.15s',
                  '&[data-selected=true]': {
                    borderColor: 'colorPalette.default',
                    bg: 'colorPalette.subtle'
                  },
                  _hover: {
                    bg: 'bg.muted'
                  },
                  '&[data-selected=true]:hover': {
                    bg: 'colorPalette.muted'
                  }
                })}
                borderRadius="lg"
                borderWidth="1px"
                w="full"
                p="4"
              >
                <Checkbox
                  checked={selectedItems.has(item.id)}
                  onChange={() => toggleItemSelection(item.id)}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                />

                <Box color="fg.muted">{getSourceIcon(item.source)}</Box>

                <VStack flex="1" gap="1" alignItems="flex-start">
                  <Text fontSize="sm" fontWeight="medium">
                    {item.title}
                  </Text>
                  {item.description && (
                    <Text color="fg.muted" fontSize="xs">
                      {item.description}
                    </Text>
                  )}
                  <Text color="fg.subtle" fontSize="xs">
                    {new Date(item.createdAt).toLocaleDateString()} • {item.source}
                  </Text>
                </VStack>

                <HStack onClick={(e: React.MouseEvent) => e.stopPropagation()} gap="1">
                  <IconButton
                    onClick={() => openDestinationModal(item.id)}
                    variant="ghost"
                    size="sm"
                    aria-label="Move to board"
                    title="Move to board"
                  >
                    <ArrowRight width="16" height="16" />
                  </IconButton>
                  <IconButton
                    onClick={() => {
                      void (async () => {
                        const confirmed = await confirm({
                          title: 'Delete Item',
                          description: `Are you sure you want to delete "${item.title}"? This action cannot be undone.`,
                          confirmText: 'Delete',
                          variant: 'danger'
                        });
                        if (confirmed) {
                          deleteItems.mutate([item.id]);
                        }
                      })();
                    }}
                    variant="ghost"
                    size="sm"
                    aria-label="Delete item"
                    title="Delete item"
                    colorPalette="red"
                  >
                    <Trash2 width="16" height="16" />
                  </IconButton>
                </HStack>
              </HStack>
            ))}
          </VStack>
        )}
      </VStack>

      {/* Destination Selection Modal */}
      <Dialog.Root
        open={showDestinationModal}
        onOpenChange={(e) => setShowDestinationModal(e.open)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="xl">
            <VStack gap="6" alignItems="stretch" p="6">
              <VStack gap="1" alignItems="stretch">
                <Dialog.Title>Move to Board</Dialog.Title>
                <Dialog.Description>
                  Select where to add {pendingItems.length}{' '}
                  {pendingItems.length === 1 ? 'item' : 'items'}
                </Dialog.Description>
              </VStack>

              <VStack gap="4" alignItems="stretch">
                {boards?.map((board: BoardWithColumns) => (
                  <Box key={board.id}>
                    <Text mb="3" color="fg.muted" fontSize="sm" fontWeight="semibold">
                      {board.name}
                    </Text>
                    <Grid gap="2" columns={2}>
                      {board.columns.map((column) => (
                        <Button
                          key={column.id}
                          onClick={() => setSelectedColumn(column.id)}
                          variant={selectedColumn === column.id ? 'solid' : 'outline'}
                          size="sm"
                          justifyContent="flex-start"
                        >
                          {column.name}
                        </Button>
                      ))}
                    </Grid>
                  </Box>
                ))}
              </VStack>

              <HStack gap="2" justifyContent="flex-end">
                <Dialog.CloseTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.CloseTrigger>
                <Button onClick={() => void handleConfirmConvert()} variant="solid">
                  Move {pendingItems.length === 1 ? 'Item' : 'Items'}
                </Button>
              </HStack>
            </VStack>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  );
}
