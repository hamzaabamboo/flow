import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  rectIntersection
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useDialogs } from '../../utils/useDialogs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Text } from '../ui/text';
import * as Dialog from '../ui/styled/dialog';
import { Select, createListCollection } from '../ui/select';
import type { BoardWithColumns, Task, Column } from '../../shared/types';
import { TaskDialog } from './TaskDialog';
import { KanbanColumn } from './KanbanColumn';
import { Box, HStack, VStack } from 'styled-system/jsx';
import { api } from '../../api/client';

interface KanbanBoardProps {
  board: BoardWithColumns;
  tasks: Task[];
  onTaskUpdate?: () => void;
  onCopySummary?: (columnId: string) => void;
}

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

export function KanbanBoard({ board, tasks, onTaskUpdate, onCopySummary }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const { alert } = useDialogs();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskColumnId, setNewTaskColumnId] = useState<string | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isAddColumnDialogOpen, setIsAddColumnDialogOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [taskToMove, setTaskToMove] = useState<Task | null>(null);
  const [selectedTargetBoardId, setSelectedTargetBoardId] = useState<string>('');
  const [selectedTargetColumnId, setSelectedTargetColumnId] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 50,
        tolerance: 5
      }
    })
  );

  // Fetch all boards for move dialog
  const { data: allBoards = [] } = useQuery<BoardWithColumns[]>({
    queryKey: ['boards', board.space],
    queryFn: async () => {
      const { data, error } = await api.api.boards.get({ query: { space: board.space } });
      if (error) throw new Error('Failed to fetch boards');
      return data as unknown as BoardWithColumns[];
    }
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Partial<Task>) => {
      const { data: result, error } = await api.api.tasks.post(
        taskData as unknown as { title: string }
      );
      if (error) throw new Error('Failed to create task');
      return result;
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
      const { data, error } = await api.api.tasks({ id: taskId }).patch(updates);
      if (error) throw new Error('Failed to update task');
      return data;
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
      const { data, error } = await api.api.tasks({ id: taskId }).delete();
      if (error) throw new Error('Failed to delete task');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', board.id] });
      onTaskUpdate?.();
    }
  });

  // Duplicate task mutation
  const duplicateTaskMutation = useMutation({
    mutationFn: async (task: Task) => {
      const { data, error } = await api.api.tasks.post({
        title: `${task.title} (Copy)`,
        description: task.description,
        priority: task.priority,
        columnId: task.columnId,
        labels: task.labels,
        subtasks: task.subtasks?.map((st) => ({ title: st.title, completed: false }))
      } as unknown as { title: string });
      if (error) throw new Error('Failed to duplicate task');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', board.id] });
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      onTaskUpdate?.();
    }
  });

  // Move task mutation
  const moveTaskMutation = useMutation({
    mutationFn: async ({ taskId, columnId }: { taskId: string; columnId: string }) => {
      const { data, error } = await api.api.tasks({ id: taskId }).patch({ columnId });
      if (error) throw new Error('Failed to move task');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', board.id] });
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      queryClient.invalidateQueries({ queryKey: ['allTasks'] });
      setIsMoveDialogOpen(false);
      setTaskToMove(null);
      onTaskUpdate?.();
    }
  });

  // Create column mutation
  const createColumnMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await api.api.columns.post({ boardId: board.id, name });
      if (error) throw new Error('Failed to create column');
      return data;
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
      const { data, error } = await api.api.columns({ columnId }).patch(updates);
      if (error) throw new Error('Failed to update column');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', board.id] });
    }
  });

  // Delete column mutation
  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      const { data, error } = await api.api.columns({ columnId }).delete();
      if (error) {
        const errorMsg = typeof error.value === 'string' ? error.value : 'Failed to delete column';
        throw new Error(errorMsg);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', board.id] });
    },
    onError: (error) => {
      void alert({
        title: 'Error',
        description: error.message,
        variant: 'danger'
      });
    }
  });

  // Reorder columns mutation (currently unused but kept for future column reordering feature)
  const _reorderColumnsMutation = useMutation({
    mutationFn: async (columnOrder: string[]) => {
      const { data, error } = await api.api.columns.reorder.post({
        boardId: board.id,
        columnOrder
      });
      if (error) throw new Error('Failed to reorder columns');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', board.id] });
    }
  });

  // Task reorder mutation
  const reorderTasksMutation = useMutation({
    mutationFn: async ({ columnId, taskIds }: { columnId: string; taskIds: string[] }) => {
      const { data, error } = await api.api.tasks.reorder.post({ columnId, taskIds });
      if (error) throw new Error('Failed to reorder tasks');
      return data;
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
      dueDate: (formData.get('dueDate') as string) || undefined,
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
    : board.columns.toSorted((a, b) => (a.position || 0) - (b.position || 0));

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
                    onDuplicateTask={(task) => duplicateTaskMutation.mutate(task)}
                    onMoveTask={(task) => {
                      setTaskToMove(task);
                      setSelectedTargetBoardId(board.id);
                      setSelectedTargetColumnId(task.columnId);
                      setIsMoveDialogOpen(true);
                    }}
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

      {/* Move Task Dialog */}
      <Dialog.Root
        open={isMoveDialogOpen}
        onOpenChange={(details) => setIsMoveDialogOpen(details.open)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="500px">
            <VStack gap="4" alignItems="stretch" p="6">
              <VStack gap="1" alignItems="stretch">
                <Dialog.Title>Move Task</Dialog.Title>
                <Dialog.Description>
                  Move "{taskToMove?.title}" to a different board or column
                </Dialog.Description>
              </VStack>

              <VStack gap="3" alignItems="stretch">
                <Box>
                  <Text mb="2" fontSize="sm" fontWeight="medium">
                    Target Board
                  </Text>
                  <Select.Root
                    collection={createListCollection({
                      items: allBoards.map((b) => ({ label: b.name, value: b.id }))
                    })}
                    value={[selectedTargetBoardId]}
                    onValueChange={(details) => {
                      const newBoardId = details.value[0];
                      setSelectedTargetBoardId(newBoardId);
                      const targetBoard = allBoards.find((b) => b.id === newBoardId);
                      if (targetBoard && targetBoard.columns.length > 0) {
                        setSelectedTargetColumnId(targetBoard.columns[0].id);
                      }
                    }}
                  >
                    <Select.Trigger>
                      <Select.ValueText placeholder="Select Board" />
                    </Select.Trigger>
                    <Select.Positioner>
                      <Select.Content>
                        {allBoards.map((b) => (
                          <Select.Item key={b.id} item={{ label: b.name, value: b.id }}>
                            <Select.ItemText>{b.name}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Select.Root>
                </Box>

                {selectedTargetBoardId && (
                  <Box>
                    <Text mb="2" fontSize="sm" fontWeight="medium">
                      Target Column
                    </Text>
                    <Select.Root
                      collection={createListCollection({
                        items:
                          allBoards
                            .find((b) => b.id === selectedTargetBoardId)
                            ?.columns.map((c) => ({ label: c.name, value: c.id })) || []
                      })}
                      value={[selectedTargetColumnId]}
                      onValueChange={(details) => setSelectedTargetColumnId(details.value[0])}
                    >
                      <Select.Trigger>
                        <Select.ValueText placeholder="Select Column" />
                      </Select.Trigger>
                      <Select.Positioner>
                        <Select.Content>
                          {allBoards
                            .find((b) => b.id === selectedTargetBoardId)
                            ?.columns.map((col) => (
                              <Select.Item key={col.id} item={{ label: col.name, value: col.id }}>
                                <Select.ItemText>{col.name}</Select.ItemText>
                              </Select.Item>
                            ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Select.Root>
                  </Box>
                )}
              </VStack>

              <HStack gap="3" justifyContent="flex-end">
                <Dialog.CloseTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.CloseTrigger>
                <Button
                  onClick={() => {
                    if (taskToMove && selectedTargetColumnId) {
                      moveTaskMutation.mutate({
                        taskId: taskToMove.id,
                        columnId: selectedTargetColumnId
                      });
                    }
                  }}
                  disabled={!selectedTargetColumnId || moveTaskMutation.isPending}
                >
                  Move Task
                </Button>
              </HStack>
            </VStack>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

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
