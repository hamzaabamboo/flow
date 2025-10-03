import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  rectIntersection
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Text } from '../ui/text';
import * as Dialog from '../ui/styled/dialog';
import type { BoardWithColumns, Task, Column } from '../../shared/types';
import { TaskDialog } from './TaskDialog';
import { KanbanColumn } from './KanbanColumn';
import { Box, HStack, VStack } from 'styled-system/jsx';

interface KanbanBoardProps {
  board: BoardWithColumns;
  tasks: Task[];
  onTaskUpdate?: () => void;
  onCopySummary?: (columnId: string) => void;
}

export function KanbanBoard({ board, tasks, onTaskUpdate, onCopySummary }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskColumnId, setNewTaskColumnId] = useState<string | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isAddColumnDialogOpen, setIsAddColumnDialogOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5
      }
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    })
  );

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', board.id] });
      setIsTaskDialogOpen(false);
      setNewTaskColumnId(null);
      onTaskUpdate?.();
    }
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', board.id] });
      setEditingTask(null);
      setIsTaskDialogOpen(false);
      onTaskUpdate?.();
    }
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to delete task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', board.id] });
      onTaskUpdate?.();
    }
  });

  // Create column mutation
  const createColumnMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ boardId: board.id, name })
      });
      if (!response.ok) throw new Error('Failed to create column');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', board.id] });
      setIsAddColumnDialogOpen(false);
      setNewColumnName('');
    }
  });

  // Update column mutation
  const updateColumnMutation = useMutation({
    mutationFn: async ({ columnId, updates }: { columnId: string; updates: Partial<Column> }) => {
      const response = await fetch(`/api/columns/${columnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update column');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', board.id] });
    }
  });

  // Delete column mutation
  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      const response = await fetch(`/api/columns/${columnId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete column');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', board.id] });
    },
    onError: (error) => {
      alert(error.message);
    }
  });

  // Reorder columns mutation (currently unused but kept for future column reordering feature)
  const _reorderColumnsMutation = useMutation({
    mutationFn: async (columnOrder: string[]) => {
      const response = await fetch('/api/columns/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ boardId: board.id, columnOrder })
      });
      if (!response.ok) throw new Error('Failed to reorder columns');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', board.id] });
    }
  });

  // Task reorder mutation
  const reorderTasksMutation = useMutation({
    mutationFn: async ({ columnId, taskIds }: { columnId: string; taskIds: string[] }) => {
      const response = await fetch('/api/tasks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ columnId, taskIds })
      });
      if (!response.ok) throw new Error('Failed to reorder tasks');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', board.id] });
    }
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeData = active.data.current;
    const overData = over.data.current;

    // If dragging a column over another column, handle column reordering
    if (activeData?.type === 'column' && overData?.type === 'column') {
      const oldIndex = sortedColumns.findIndex((col) => col.id === activeId);
      const newIndex = sortedColumns.findIndex((col) => col.id === overId);

      if (oldIndex !== newIndex) {
        const newOrder = [...sortedColumns];
        const [removed] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, removed);

        // Update the order on the server
        _reorderColumnsMutation.mutate(newOrder.map((c) => c.id));
      }
      return;
    }

    // Find the task being dragged
    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Determine the target column
    let targetColumnId: string;
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      targetColumnId = overTask.columnId;
    } else {
      // Dropping on a column
      targetColumnId = overId;
    }

    // If moving to a different column
    if (activeTask.columnId !== targetColumnId) {
      updateTaskMutation.mutate({
        taskId: activeTask.id,
        updates: { columnId: targetColumnId }
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeData = active.data.current;

    // If we were dragging a column, the reordering already happened in handleDragOver
    if (activeData?.type === 'column') {
      return;
    }

    const activeTask = tasks.find((t) => t.id === activeId);
    const overTask = tasks.find((t) => t.id === overId);

    if (!activeTask) return;

    // If dropped on a task, reorder within the column
    if (overTask && activeTask.columnId === overTask.columnId) {
      const columnTasks = getTasksByColumn(activeTask.columnId);
      const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
      const newIndex = columnTasks.findIndex((t) => t.id === overId);

      if (oldIndex !== newIndex) {
        const newOrder = [...columnTasks];
        const [removed] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, removed);

        reorderTasksMutation.mutate({
          columnId: activeTask.columnId,
          taskIds: newOrder.map((t) => t.id)
        });
      }
    }
  };

  const handleRenameColumn = (columnId: string, name: string) => {
    updateColumnMutation.mutate({ columnId, updates: { name } });
  };

  const handleUpdateWipLimit = (columnId: string, wipLimit: number | null) => {
    updateColumnMutation.mutate({ columnId, updates: { wipLimit } });
  };

  const handleAddColumn = () => {
    if (newColumnName.trim()) {
      createColumnMutation.mutate(newColumnName.trim());
    }
  };

  const handleTaskSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Parse JSON fields
    const labelsStr = formData.get('labels') as string;
    const subtasksStr = formData.get('subtasks') as string;
    const recurringPattern = formData.get('recurringPattern') as string;
    const recurringEndDate = formData.get('recurringEndDate') as string;
    const createReminder = formData.get('createReminder') === 'true';

    const data: Partial<Task> = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      priority: formData.get('priority') as Task['priority'],
      dueDate: formData.get('dueDate') as string,
      columnId: formData.get('columnId') as string,
      labels: labelsStr ? JSON.parse(labelsStr) : undefined,
      subtasks: subtasksStr ? JSON.parse(subtasksStr) : undefined,
      recurringPattern: recurringPattern || undefined,
      recurringEndDate: recurringEndDate || undefined,
      createReminder: createReminder || undefined,
      link: (formData.get('link') as string) || undefined
    };

    if (editingTask) {
      updateTaskMutation.mutate({
        taskId: editingTask.id,
        updates: data
      });
    } else if (newTaskColumnId) {
      createTaskMutation.mutate({
        ...data,
        columnId: newTaskColumnId
      });
    }
  };

  const getTasksByColumn = (columnId: string) => {
    const column = board.columns.find((col) => col.id === columnId);
    const columnTasks = tasks.filter((task) => task.columnId === columnId);

    // Sort tasks based on taskOrder if available
    if (column?.taskOrder && column.taskOrder.length > 0) {
      const ordered = column.taskOrder
        .map((taskId) => columnTasks.find((task) => task.id === taskId))
        .filter(Boolean) as Task[];

      // Add any tasks not in the order at the end
      const unorderedTasks = columnTasks.filter((task) => !column.taskOrder?.includes(task.id));

      return [...ordered, ...unorderedTasks];
    }

    return columnTasks;
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return 'red';
      case 'high':
        return 'orange';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'green';
      default:
        return 'gray';
    }
  };

  const openAddTaskDialog = (columnId: string) => {
    setNewTaskColumnId(columnId);
    setEditingTask(null);
    setIsTaskDialogOpen(true);
  };

  const openEditTaskDialog = (task: Task) => {
    setEditingTask(task);
    setNewTaskColumnId(null);
    setIsTaskDialogOpen(true);
  };

  // Sort columns by columnOrder or position
  const sortedColumns = board.columnOrder
    ? (board.columnOrder
        .map((id) => board.columns.find((col) => col.id === id))
        .filter(Boolean) as Column[])
    : board.columns.sort((a, b) => (a.position || 0) - (b.position || 0));

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <>
      <Box
        flex="1"
        maxH={{ base: 'none', md: 'calc(100vh - 120px)' }}
        overflow={{ base: 'visible', md: 'auto' }}
      >
        <Box p={{ base: '3', md: '6' }}>
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedColumns.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              <HStack
                gap={{ base: '3', md: '4' }}
                alignItems="stretch"
                minH="full"
                overflowX={{ base: 'auto', md: 'visible' }}
                flexWrap={{ base: 'nowrap', md: 'nowrap' }}
              >
                {sortedColumns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    tasks={getTasksByColumn(column.id)}
                    onAddTask={() => openAddTaskDialog(column.id)}
                    onEditTask={openEditTaskDialog}
                    onDeleteTask={(task) => deleteTaskMutation.mutate(task.id)}
                    getPriorityColor={getPriorityColor}
                    onRenameColumn={handleRenameColumn}
                    onDeleteColumn={(id) => deleteColumnMutation.mutate(id)}
                    onUpdateWipLimit={handleUpdateWipLimit}
                    boardId={board.id}
                    onCopySummary={onCopySummary}
                  />
                ))}

                {/* Add Column Button */}
                <Box
                  onClick={() => setIsAddColumnDialogOpen(true)}
                  cursor="pointer"
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  borderColor="border.default"
                  borderRadius="lg"
                  borderWidth="2px"
                  minW="300px"
                  p="4"
                  bg="bg.muted"
                  transition="all 0.2s"
                  borderStyle="dashed"
                  _hover={{ borderColor: 'colorPalette.default' }}
                >
                  <VStack gap="2">
                    <Plus width="24" height="24" />
                    <Text fontSize="sm" fontWeight="medium">
                      Add Column
                    </Text>
                  </VStack>
                </Box>
              </HStack>
            </SortableContext>

            <DragOverlay>
              {activeTask ? (
                <Box
                  borderColor="colorPalette.default"
                  borderRadius="md"
                  borderWidth="2px"
                  w="280px"
                  p="3"
                  bg="bg.default"
                  opacity={0.9}
                  boxShadow="lg"
                >
                  <Text fontSize="sm" fontWeight="medium">
                    {activeTask.title}
                  </Text>
                </Box>
              ) : activeId && sortedColumns.find((c) => c.id === activeId) ? (
                <Box
                  borderColor="colorPalette.default"
                  borderRadius="lg"
                  borderWidth="2px"
                  w="320px"
                  p="4"
                  bg="bg.muted"
                  opacity={0.9}
                  boxShadow="xl"
                >
                  <Text fontSize="sm" fontWeight="semibold">
                    {sortedColumns.find((c) => c.id === activeId)?.name}
                  </Text>
                </Box>
              ) : null}
            </DragOverlay>
          </DndContext>
        </Box>
      </Box>

      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={(isOpen) => {
          setIsTaskDialogOpen(isOpen);
          if (!isOpen) {
            setTimeout(() => {
              setEditingTask(null);
              setNewTaskColumnId(null);
            }, 200);
          }
        }}
        task={editingTask}
        onSubmit={handleTaskSubmit}
        mode={editingTask ? 'edit' : 'create'}
        defaultColumnId={newTaskColumnId || undefined}
        columns={board.columns}
      />

      {/* Add Column Dialog */}
      <Dialog.Root
        open={isAddColumnDialogOpen}
        onOpenChange={(details) => setIsAddColumnDialogOpen(details.open)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content borderColor="border.default" maxW="400px" bg="bg.default">
            <VStack gap="4" p="6">
              <VStack gap="1">
                <Dialog.Title>Add New Column</Dialog.Title>
                <Dialog.Description>Create a new column for your board</Dialog.Description>
              </VStack>

              <Box w="full">
                <Text mb="1" fontSize="sm" fontWeight="medium">
                  Column Name
                </Text>
                <Input
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="Enter column name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddColumn();
                    }
                  }}
                />
              </Box>

              <HStack gap="2" w="full" pt="2">
                <Dialog.CloseTrigger asChild>
                  <Button variant="outline" w="full">
                    Cancel
                  </Button>
                </Dialog.CloseTrigger>
                <Button onClick={handleAddColumn} w="full">
                  Create Column
                </Button>
              </HStack>
            </VStack>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
}

export default KanbanBoard;
