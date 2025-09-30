import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Text } from '../ui/text';
import * as Dialog from '../ui/styled/dialog';
import { TaskDialog } from './TaskDialog';
import { KanbanColumn, type Task, type Column } from './KanbanColumn';
import { Box, HStack, VStack } from 'styled-system/jsx';

interface Board {
  id: string;
  name: string;
  space: 'work' | 'personal';
  columnOrder?: string[];
  columns: Column[];
}

interface KanbanBoardProps {
  board: Board;
  tasks: Task[];
  onTaskUpdate?: () => void;
}

export function KanbanBoard({ board, tasks, onTaskUpdate }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<Column | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskColumnId, setNewTaskColumnId] = useState<string | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isAddColumnDialogOpen, setIsAddColumnDialogOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

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

  // Reorder columns mutation
  const reorderColumnsMutation = useMutation({
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

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

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

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (draggedTask) {
      const targetColumn = board.columns.find((col) => col.id === columnId);
      if (!targetColumn) return;

      const sourceTasks = getTasksByColumn(draggedTask.columnId);
      const targetTasks = getTasksByColumn(columnId);

      if (draggedTask.columnId === columnId) {
        // Reorder within the same column
        const filteredTasks = sourceTasks.filter((t) => t.id !== draggedTask.id);
        const dropIndex = parseInt(e.dataTransfer.getData('dropIndex') || '0');
        const newTaskOrder = [
          ...filteredTasks.slice(0, dropIndex),
          draggedTask,
          ...filteredTasks.slice(dropIndex)
        ];

        reorderTasksMutation.mutate({
          columnId,
          taskIds: newTaskOrder.map((t) => t.id)
        });
      } else {
        // Move to different column
        updateTaskMutation.mutate({
          taskId: draggedTask.id,
          updates: { columnId }
        });

        // Update source column order
        const sourceTaskIds = sourceTasks.filter((t) => t.id !== draggedTask.id).map((t) => t.id);
        reorderTasksMutation.mutate({
          columnId: draggedTask.columnId,
          taskIds: sourceTaskIds
        });

        // Update target column order
        const targetTaskIds = [...targetTasks.map((t) => t.id), draggedTask.id];
        reorderTasksMutation.mutate({
          columnId,
          taskIds: targetTaskIds
        });
      }
    }
    setDraggedTask(null);
  };

  const handleDragStartColumn = (e: React.DragEvent, column: Column) => {
    setDraggedColumn(column);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropColumn = (e: React.DragEvent, targetColumn: Column) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn.id !== targetColumn.id) {
      const currentOrder = board.columnOrder || board.columns.map((c) => c.id);
      const dragIndex = currentOrder.indexOf(draggedColumn.id);
      const dropIndex = currentOrder.indexOf(targetColumn.id);

      if (dragIndex !== -1 && dropIndex !== -1) {
        const newOrder = [...currentOrder];
        newOrder.splice(dragIndex, 1);
        newOrder.splice(dropIndex, 0, draggedColumn.id);
        reorderColumnsMutation.mutate(newOrder);
      }
    }
    setDraggedColumn(null);
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
    const data = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      priority: formData.get('priority') as Task['priority'],
      dueDate: formData.get('dueDate') as string,
      columnId: formData.get('columnId') as string
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

  return (
    <>
      <Box flex="1" p="6" overflow="auto">
        <HStack gap="4" alignItems="stretch" minHeight="full">
          {sortedColumns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={getTasksByColumn(column.id)}
              onAddTask={() => openAddTaskDialog(column.id)}
              onEditTask={openEditTaskDialog}
              onDeleteTask={(task) => deleteTaskMutation.mutate(task.id)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
              onDragStartColumn={handleDragStartColumn}
              onDropColumn={(e) => handleDropColumn(e, column)}
              getPriorityColor={getPriorityColor}
              onRenameColumn={handleRenameColumn}
              onDeleteColumn={(id) => deleteColumnMutation.mutate(id)}
              onUpdateWipLimit={handleUpdateWipLimit}
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
      </Box>

      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
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
          <Dialog.Content maxW="400px">
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
