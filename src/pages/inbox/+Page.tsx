import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSpace } from '../../contexts/SpaceContext';
import { Button } from '../../components/ui/button';
import * as Card from '../../components/ui/styled/card';
import { Checkbox } from '../../components/ui/checkbox';
import { Text } from '../../components/ui/text';
import { Heading } from '../../components/ui/heading';
import { VStack, HStack, Box, Container } from 'styled-system/jsx';

interface InboxItem {
  id: string;
  title: string;
  description?: string;
  source: string;
  createdAt: string;
}

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
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
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
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
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
        return '💬';
      case 'hambot':
        return '🤖';
      case 'email':
        return '📧';
      default:
        return '📝';
    }
  };

  if (isLoading) {
    return (
      <Container maxW="4xl" py="8">
        <Text>Loading inbox...</Text>
      </Container>
    );
  }

  return (
    <Container maxW="4xl" py="8">
      <HStack justifyContent="space-between" alignItems="center" mb="8">
        <Heading size="3xl">Inbox ({currentSpace})</Heading>

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
              variant="solid"
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
        <Card.Root textAlign="center" bg="bg.subtle">
          <Card.Body py="12">
            <Text mb="2" color="fg.muted" fontSize="lg">
              Your inbox is empty! 🎉
            </Text>
            <Text color="fg.subtle">
              New items will appear here when you use the command bar or receive messages.
            </Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <VStack gap="2">
          {items.map((item) => (
            <Card.Root
              key={item.id}
              onClick={() => toggleItemSelection(item.id)}
              cursor="pointer"
              borderColor={selectedItems.has(item.id) ? 'colorPalette.default' : 'border.default'}
              borderWidth="2px"
              bg={selectedItems.has(item.id) ? 'colorPalette.subtle' : 'bg.default'}
              transition="all 0.2s"
              _hover={{
                borderColor: 'colorPalette.emphasized'
              }}
            >
              <Card.Body>
                <HStack gap="4" alignItems="center">
                  <Checkbox
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleItemSelection(item.id)}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  />

                  <Text fontSize="xl">{getSourceIcon(item.source)}</Text>

                  <Box flex="1">
                    <Text fontWeight="medium">{item.title}</Text>
                    {item.description && (
                      <Text mt="1" color="fg.muted" fontSize="sm">
                        {item.description}
                      </Text>
                    )}
                  </Box>

                  <Text color="fg.subtle" fontSize="xs">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </HStack>
              </Card.Body>
            </Card.Root>
          ))}
        </VStack>
      )}
    </Container>
  );
}
