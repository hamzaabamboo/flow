import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Text } from '../ui/text';
import { Badge } from '../ui/badge';
import { TaskCard } from './TaskCard';
import { VStack, HStack, Box } from 'styled-system/jsx';

interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  completed: boolean;
}

interface ColumnProps {
  column: {
    id: string;
    name: string;
    tasks: Task[];
  };
  onDragStart: (task: Task) => void;
  onDrop: (columnId: string) => void;
  boardId: string;
}

export function Column({ column, onDragStart, onDrop, boardId }: ColumnProps) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const queryClient = useQueryClient();

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columnId: column.id,
          userId: 'temp-user-id', // TODO: Get from auth
          title
        })
      });
      if (!response.ok) throw new Error('Failed to create task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      setNewTaskTitle('');
      setIsAddingTask(false);
    }
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onDrop(column.id);
  };

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      createTaskMutation.mutate(newTaskTitle);
    }
  };

  return (
    <Box
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      display="flex"
      flexDirection="column"
      borderColor={isDragOver ? 'colorPalette.default' : undefined}
      borderRadius="lg"
      borderWidth={isDragOver ? '2px' : undefined}
      minWidth="320px"
      maxHeight="100%"
      p="4"
      bg={isDragOver ? 'colorPalette.subtle' : 'bg.muted'}
      transition="all 0.2s"
      borderStyle={isDragOver ? 'dashed' : undefined}
    >
      <HStack justifyContent="space-between" alignItems="center" mb="4">
        <Text fontSize="md" fontWeight="semibold">
          {column.name}
        </Text>
        <Badge variant="outline">{column.tasks.length}</Badge>
      </HStack>

      <VStack flex="1" gap="2" overflowY="auto">
        {column.tasks.map((task) => (
          <TaskCard key={task.id} task={task} onDragStart={onDragStart} />
        ))}
      </VStack>

      {isAddingTask ? (
        <VStack gap="2" mt="4">
          <Input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTask();
              if (e.key === 'Escape') setIsAddingTask(false);
            }}
            placeholder="Enter task title..."
          />
          <HStack gap="2" width="100%">
            <Button onClick={handleAddTask} variant="solid" size="sm" flex="1">
              Add
            </Button>
            <Button onClick={() => setIsAddingTask(false)} variant="outline" size="sm" flex="1">
              Cancel
            </Button>
          </HStack>
        </VStack>
      ) : (
        <Button
          onClick={() => setIsAddingTask(true)}
          variant="ghost"
          borderColor="border.default"
          borderWidth="1px"
          width="100%"
          mt="4"
          color="fg.muted"
          borderStyle="dashed"
          _hover={{
            borderColor: 'border.emphasized',
            bg: 'bg.subtle'
          }}
        >
          + Add a task
        </Button>
      )}
    </Box>
  );
}
