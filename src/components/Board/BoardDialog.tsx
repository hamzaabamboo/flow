import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
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
import { api } from '../../api/client';
import type { Board } from '../../shared/types/board';
import { navigate } from 'vike/client/router';

interface BoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (boardId: string) => void;
  board?: Board; // If provided, we are in edit mode
}

export function BoardDialog({ open, onOpenChange, onSuccess, board }: BoardDialogProps) {
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();
  const { toast } = useToaster();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!board;

  // Focus input when dialog opens and populate fields if editing
  useEffect(() => {
    if (open) {
      if (board) {
        setName(board.name);
        setDescription(board.description || '');
      } else {
        setName('');
        setDescription('');
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, board]);

  const createBoard = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.api.boards.post({
        name: name.trim(),
        description: description.trim() || undefined,
        space: currentSpace
      });
      if (error) throw new Error('Failed to create board');
      return data;
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

  const updateBoard = useMutation({
    mutationFn: async () => {
      if (!board) throw new Error('No board to update');
      const { data, error } = await api.api.boards({ boardId: board.id }).patch({
        name: name.trim(),
        description: description.trim() || undefined
      });
      if (error) throw new Error('Failed to update board');
      return data;
    },
    onSuccess: (updatedBoard) => {
      queryClient.invalidateQueries({ queryKey: ['boards', currentSpace] });
      queryClient.invalidateQueries({ queryKey: ['board', updatedBoard.id] });
      toast?.('Board updated successfully', { type: 'success' });
      onOpenChange(false);
      if (onSuccess) {
        onSuccess(updatedBoard.id);
      }
    },
    onError: () => {
      toast?.('Failed to update board', { type: 'error' });
    }
  });

  const deleteBoard = useMutation({
    mutationFn: async () => {
      if (!board) throw new Error('No board to delete');
      const { error } = await api.api.boards({ boardId: board.id }).delete();
      if (error) throw new Error('Failed to delete board');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards', currentSpace] });
      toast?.('Board deleted successfully', { type: 'success' });
      onOpenChange(false);
      navigate('/boards');
    },
    onError: () => {
      toast?.('Failed to delete board', { type: 'error' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      if (isEditMode) {
        updateBoard.mutate();
      } else {
        createBoard.mutate();
      }
    }
  };

  const handleDelete = () => {
    if (
      window.confirm('Are you sure you want to delete this board? This action cannot be undone.')
    ) {
      deleteBoard.mutate();
    }
  };

  const isPending = createBoard.isPending || updateBoard.isPending || deleteBoard.isPending;

  return (
    <Dialog.Root open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="600px">
          <VStack gap="6" alignItems="stretch" p="6">
            <VStack gap="1" alignItems="stretch">
              <HStack justifyContent="space-between" alignItems="start">
                <VStack flex="1" gap="1" alignItems="start">
                  <Dialog.Title>{isEditMode ? 'Edit Board' : 'Create New Board'}</Dialog.Title>
                  <Dialog.Description>
                    {isEditMode
                      ? `Update details for board "${board.name}"`
                      : `Add a new board to organize your ${currentSpace} tasks`}
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

            <HStack gap="3" justifyContent="space-between">
              {isEditMode ? (
                <Button
                  variant="outline"
                  visual="error"
                  onClick={handleDelete}
                  loading={deleteBoard.isPending}
                  disabled={isPending}
                >
                  <Trash2 width="16" height="16" />
                  Delete Board
                </Button>
              ) : (
                <Box /> // Spacer
              )}
              <HStack gap="3">
                <Dialog.CloseTrigger asChild>
                  <Button variant="outline">
                    <X width="16" height="16" />
                    Cancel
                  </Button>
                </Dialog.CloseTrigger>
                <Button
                  variant="solid"
                  onClick={handleSubmit}
                  disabled={!name.trim() || isPending}
                  loading={isPending}
                >
                  <Save width="16" height="16" />
                  {isEditMode ? 'Save Changes' : 'Create Board'}
                </Button>
              </HStack>
            </HStack>
          </VStack>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
