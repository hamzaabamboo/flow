import React, { useState } from 'react';
import { Check, X, Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { IconButton } from '../ui/icon-button';
import { Text } from '../ui/text';
import type { Subtask } from '../../shared/types';
import { HStack, VStack } from 'styled-system/jsx';
import { api } from '../../api/client';

interface SubtaskListProps {
  taskId: string;
  compact?: boolean;
}

export function SubtaskList({ taskId, compact = false }: SubtaskListProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Fetch subtasks
  const { data: subtasks = [] } = useQuery<Subtask[]>({
    queryKey: ['subtasks', taskId],
    queryFn: async () => {
      const { data, error } = await api.api.subtasks.task({ taskId }).get();
      if (error) throw new Error('Failed to fetch subtasks');
      return data;
    }
  });

  // Create subtask mutation
  const createSubtaskMutation = useMutation({
    mutationFn: async (title: string) => {
      const { data, error } = await api.api.subtasks.post({ taskId, title });
      if (error) throw new Error('Failed to create subtask');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
      setNewSubtaskTitle('');
      setIsAdding(false);
    }
  });

  // Update subtask mutation
  const updateSubtaskMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { data, error } = await api.api.subtasks({ id }).patch({ completed });
      if (error) throw new Error('Failed to update subtask');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
    }
  });

  // Delete subtask mutation
  const deleteSubtaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.subtasks({ id }).delete();
      if (error) throw new Error('Failed to delete subtask');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
    }
  });

  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim()) {
      createSubtaskMutation.mutate(newSubtaskTitle.trim());
    }
  };

  const completedCount = subtasks.filter((s) => s.completed).length;
  const totalCount = subtasks.length;

  if (compact && totalCount === 0) {
    return null;
  }

  if (compact) {
    return (
      <HStack gap="1" color="fg.muted" fontSize="xs">
        <Text>
          {completedCount}/{totalCount}
        </Text>
        <Text>subtasks</Text>
      </HStack>
    );
  }

  return (
    <VStack gap="2" alignItems="start" w="full">
      {totalCount > 0 && (
        <HStack gap="2" justifyContent="space-between" w="full">
          <Text fontSize="sm" fontWeight="medium">
            Subtasks ({completedCount}/{totalCount})
          </Text>
          {!isAdding && (
            <IconButton size="xs" variant="ghost" onClick={() => setIsAdding(true)} aria-label="Add subtask">
              <Plus size={14} />
            </IconButton>
          )}
        </HStack>
      )}

      {subtasks.map((subtask) => (
        <HStack key={subtask.id} gap="2" w="full">
          <Checkbox
            size="sm"
            checked={subtask.completed}
            onCheckedChange={(e) => {
              updateSubtaskMutation.mutate({
                id: subtask.id,
                completed: e.checked as boolean
              });
            }}
          />
          <Text
            flex="1"
            color={subtask.completed ? 'fg.muted' : 'fg.default'}
            textDecoration={subtask.completed ? 'line-through' : 'none'}
            fontSize="sm"
          >
            {subtask.title}
          </Text>
          <IconButton
            size="xs"
            variant="ghost"
            onClick={() => deleteSubtaskMutation.mutate(subtask.id)}
          >
            <X size={12} />
          </IconButton>
        </HStack>
      ))}

      {(isAdding || totalCount === 0) && (
        <HStack gap="2" w="full">
          <Input
            size="sm"
            placeholder="Add subtask..."
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSubtask();
              }
            }}
          />
          <IconButton size="sm" onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()}>
            <Check size={14} />
          </IconButton>
          {isAdding && (
            <IconButton
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsAdding(false);
                setNewSubtaskTitle('');
              }}
            >
              <X size={14} />
            </IconButton>
          )}
        </HStack>
      )}
    </VStack>
  );
}
