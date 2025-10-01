import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Bot, Mail, FileText, PartyPopper } from 'lucide-react';
import { useSpace } from '../../contexts/SpaceContext';
import { Button } from '../../components/ui/button';
import * as Card from '../../components/ui/styled/card';
import { Checkbox } from '../../components/ui/checkbox';
import { Text } from '../../components/ui/text';
import { Heading } from '../../components/ui/heading';
import type { InboxItem } from '../../shared/types/misc';
import { Spinner } from '../ui/spinner';
import { VStack, HStack, Box, Center } from 'styled-system/jsx';

export default function InboxPage() {
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Fetch inbox items
  const { data: items, isLoading } = useQuery<InboxItem[]>({
    queryKey: ['inbox', currentSpace],
    queryFn: async () => {
      const response = await fetch(`/api/inbox?space=${currentSpace}`);
      if (!response.ok) throw new Error('Failed to fetch inbox items');
      return response.json();
    }
  });

  // Move to board mutation
  const moveToBoard = useMutation({
    mutationFn: async ({ itemIds, boardId }: { itemIds: string[]; boardId: string }) => {
      const response = await fetch('/api/inbox/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds, boardId })
      });
      if (!response.ok) throw new Error('Failed to move items');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox', currentSpace] });
      setSelectedItems(new Set());
    }
  });

  // Delete items mutation
  const deleteItems = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const response = await fetch('/api/inbox/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds })
      });
      if (!response.ok) throw new Error('Failed to delete items');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox', currentSpace] });
      setSelectedItems(new Set());
    }
  });

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const getSourceIcon = (source: string) => {
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

  if (isLoading) {
    return (
      <Center minH="60vh">
        <Spinner size="xl" label="Loading inbox..." />
      </Center>
    );
  }

  return (
    <Box colorPalette={currentSpace === 'work' ? 'blue' : 'purple'} p="6">
      <VStack gap="6" alignItems="stretch">
        <HStack justifyContent="space-between" alignItems="center">
          <VStack gap="1" alignItems="start">
            <Heading size="2xl">Inbox</Heading>
            <Text color="fg.muted">Process and organize your incoming items</Text>
          </VStack>

          {selectedItems.size > 0 && (
            <HStack gap="4">
              <Button
                onClick={() => {
                  // TODO: Show board selector
                  const boardId = prompt('Enter board ID:');
                  if (boardId) {
                    moveToBoard.mutate({
                      itemIds: Array.from(selectedItems),
                      boardId
                    });
                  }
                }}
                variant="solid"
              >
                Move to Board ({selectedItems.size})
              </Button>

              <Button
                onClick={() => {
                  if (confirm('Delete selected items?')) {
                    deleteItems.mutate(Array.from(selectedItems));
                  }
                }}
                variant="solid"
                colorPalette="red"
              >
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
          <VStack gap="3">
            {items.map((item) => (
              <Card.Root
                key={item.id}
                onClick={() => toggleItemSelection(item.id)}
                cursor="pointer"
                borderColor={selectedItems.has(item.id) ? 'colorPalette.default' : 'border.default'}
                borderWidth="2px"
                width="full"
                bg={selectedItems.has(item.id) ? 'colorPalette.subtle' : 'bg.default'}
                transition="all 0.2s"
                _hover={{
                  borderColor: 'colorPalette.emphasized'
                }}
              >
                <Card.Header>
                  <HStack gap="3" alignItems="center" w="full">
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onChange={() => toggleItemSelection(item.id)}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    />
                    <Text fontSize="xl">{getSourceIcon(item.source)}</Text>
                    <Box flex="1">
                      <Card.Title>{item.title}</Card.Title>
                      <Card.Description>
                        From {item.source} • {new Date(item.createdAt).toLocaleDateString()}
                      </Card.Description>
                    </Box>
                  </HStack>
                </Card.Header>

                {item.description && (
                  <Card.Body>
                    <Text color="fg.muted" fontSize="sm">
                      {item.description}
                    </Text>
                  </Card.Body>
                )}
              </Card.Root>
            ))}
          </VStack>
        )}
      </VStack>
    </Box>
  );
}
