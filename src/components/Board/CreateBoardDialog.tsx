import React, { useState, useEffect, useRef } from 'react';
import { X, Save } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSpace } from '../../contexts/SpaceContext';
import { useToaster } from '../../contexts/ToasterContext';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Text } from '../ui/text';
import * as Dialog from '../ui/styled/dialog';
import { Box, VStack, HStack } from 'styled-system/jsx';

interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (boardId: string) => void;
}

export function CreateBoardDialog({ open, onOpenChange, onSuccess }: CreateBoardDialogProps) {
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();
  const { toast } = useToaster();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Reset state when closing
      setName('');
      setDescription('');
    }
  }, [open]);

  const createBoard = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          space: currentSpace
        })
      });
      if (!response.ok) throw new Error('Failed to create board');
      return response.json();
    },
    onSuccess: (newBoard) => {
      queryClient.invalidateQueries({ queryKey: ['boards', currentSpace] });
      toast?.('Board created successfully', { type: 'success' });
      onOpenChange(false);
      if (onSuccess) {
        onSuccess(newBoard.id);
      }
    },
    onError: () => {
      toast?.('Failed to create board', { type: 'error' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      createBoard.mutate();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="600px">
          <VStack gap="6" alignItems="stretch" p="6">
            <VStack gap="1" alignItems="stretch">
              <HStack justifyContent="space-between" alignItems="start">
                <VStack flex="1" gap="1" alignItems="start">
                  <Dialog.Title>Create New Board</Dialog.Title>
                  <Dialog.Description>
                    Add a new board to organize your {currentSpace} tasks
                  </Dialog.Description>
                </VStack>
                <Dialog.CloseTrigger asChild>
                  <IconButton variant="ghost" size="sm" aria-label="Close">
                    <X />
                  </IconButton>
                </Dialog.CloseTrigger>
              </HStack>
            </VStack>

            <form onSubmit={handleSubmit}>
              <VStack gap="4" alignItems="stretch">
                <Box>
                  <Text mb="2" fontWeight="medium">
                    Board Name
                  </Text>
                  <Input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Engineering, Marketing, Home Projects..."
                    required
                  />
                </Box>

                <Box>
                  <Text mb="2" fontWeight="medium">
                    Description{' '}
                    <Text as="span" color="fg.muted">
                      (optional)
                    </Text>
                  </Text>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's this board for?"
                    rows={3}
                  />
                </Box>
              </VStack>
            </form>

            <HStack gap="3" justifyContent="flex-end">
              <Dialog.CloseTrigger asChild>
                <Button variant="outline">
                  <X width="16" height="16" />
                  Cancel
                </Button>
              </Dialog.CloseTrigger>
              <Button
                variant="solid"
                onClick={handleSubmit}
                disabled={!name.trim() || createBoard.isPending}
                loading={createBoard.isPending}
              >
                <Save width="16" height="16" />
                Create Board
              </Button>
            </HStack>
          </VStack>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
