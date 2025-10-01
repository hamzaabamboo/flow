import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, ColumnData, BoardData } from '../../shared/types';
import { useSpace } from '../../contexts/SpaceContext';
import { Heading } from '../ui/heading';
import { Text } from '../ui/text';
import { Column } from './Column';
import { Box, HStack } from 'styled-system/jsx';

export function Board({ boardId }: { boardId: string }) {
  const {} = useSpace();
  const queryClient = useQueryClient();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Fetch board data
  const { data: board, isLoading } = useQuery<BoardData>({
    queryKey: ['board', boardId],
    queryFn: async () => {
      const response = await fetch(`/api/boards/${boardId}`);
      if (!response.ok) throw new Error('Failed to fetch board');

      const boardData = await response.json();

      // Fetch tasks for each column
      const columnsWithTasks = await Promise.all(
        boardData.columns.map(async (column: ColumnData) => {
          const tasksResponse = await fetch(`/api/tasks/${column.id}`);
          const tasks = await tasksResponse.json();
          return { ...column, tasks };
        })
      );

      return { ...boardData, columns: columnsWithTasks };
    }
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      updates
    }: {
      taskId: string;
      updates: Record<string, unknown>;
    }) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    }
  });

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDrop = (targetColumnId: string) => {
    if (!draggedTask) return;

    updateTaskMutation.mutate({
      taskId: draggedTask.id,
      updates: { columnId: targetColumnId }
    });

    setDraggedTask(null);
  };

  if (isLoading) {
    return (
      <Box p="8">
        <Text>Loading board...</Text>
      </Box>
    );
  }

  if (!board) {
    return (
      <Box p="8">
        <Text>Board not found</Text>
      </Box>
    );
  }

  return (
    <Box height="calc(100vh - 80px)" p="8" bg="bg.subtle">
      <Heading size="2xl" mb="6">
        {board.name}
      </Heading>

      <HStack gap="4" alignItems="stretch" height="calc(100% - 60px)" overflowX="auto">
        {board.columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            boardId={boardId}
          />
        ))}
      </HStack>
    </Box>
  );
}
