import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { navigate } from 'vike/client/router';
import { Trash2, LayoutGrid, Copy, MoveRight } from 'lucide-react';
import type { Task } from '../../shared/types';
import { useSpace } from '../../contexts/SpaceContext';
import TaskDialog from '../../components/Board/TaskDialog';
import { TaskItem } from '../../components/Agenda/TaskItem';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/ui/icon-button';
import { Text } from '../../components/ui/text';
import { Heading } from '../../components/ui/heading';
import { Badge } from '../../components/ui/badge';
import { Box, VStack, HStack, Grid, Center } from 'styled-system/jsx';
import { createListCollection, Select } from '~/components/ui/select';
import { Input } from '~/components/ui/input';
import type { ExtendedTask } from '~/shared/types/calendar';
import type { CalendarEvent } from '~/shared/types/calendar';
import { Spinner } from '~/components/ui/spinner';
import { PriorityBadge } from '~/components/PriorityBadge';
import * as Dialog from '~/components/ui/styled/dialog';
import type { Column } from '~/shared/types';

export default function TasksPage() {
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterBoard, setFilterBoard] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [editingTask, setEditingTask] = useState<ExtendedTask | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [taskToMove, setTaskToMove] = useState<ExtendedTask | null>(null);
  const [selectedTargetBoardId, setSelectedTargetBoardId] = useState<string>('');
  const [selectedTargetColumnId, setSelectedTargetColumnId] = useState<string>('');

  // Fetch all tasks across all boards
  const { data: allTasks = [], isLoading } = useQuery<ExtendedTask[]>({
    queryKey: ['allTasks', currentSpace],
    queryFn: async () => {
      const response = await fetch(`/api/tasks?space=${currentSpace}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    }
  });

  // Fetch boards for filter options
  const { data: boards = [] } = useQuery<Array<{ id: string; name: string; columns: Column[] }>>({
    queryKey: ['boards', currentSpace],
    queryFn: async () => {
      const response = await fetch(`/api/boards?space=${currentSpace}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch boards');
      return response.json();
    }
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<ExtendedTask> }) => {
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
      queryClient.invalidateQueries({ queryKey: ['allTasks', currentSpace] });
      setEditingTask(null);
      setIsTaskDialogOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ['allTasks', currentSpace] });
    }
  });

  // Duplicate task mutation
  const duplicateTaskMutation = useMutation({
    mutationFn: async (task: ExtendedTask) => {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          columnId: task.columnId,
          title: `${task.title} (Copy)`,
          description: task.description,
          priority: task.priority,
          dueDate: task.dueDate,
          labels: task.labels,
          subtasks: task.subtasks?.map((st) => ({ title: st.title, completed: false }))
        })
      });
      if (!response.ok) throw new Error('Failed to duplicate task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTasks', currentSpace] });
      queryClient.invalidateQueries({ queryKey: ['boards', currentSpace] });
    }
  });

  // Move task mutation
  const moveTaskMutation = useMutation({
    mutationFn: async ({ taskId, columnId }: { taskId: string; columnId: string }) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ columnId })
      });
      if (!response.ok) throw new Error('Failed to move task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTasks', currentSpace] });
      queryClient.invalidateQueries({ queryKey: ['boards', currentSpace] });
      setIsMoveDialogOpen(false);
      setTaskToMove(null);
    }
  });

  // Priority weights for sorting
  const priorityWeight: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 };

  // Filter and sort tasks
  const filteredTasks = allTasks
    .filter((task) => {
      if (
        searchTerm &&
        !task.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !task.description?.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
      if (filterStatus === 'completed' && !task.completed) return false;
      if (filterStatus === 'active' && task.completed) return false;
      if (filterBoard !== 'all' && task.boardId !== filterBoard) return false;
      return true;
    })
    .sort((a, b) => {
      // Completed tasks go to bottom
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      // Sort by deadline first (tasks with no deadline go to the end)
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;

      if (aDate !== bDate) {
        return aDate - bDate;
      }

      // If deadlines are equal, sort by priority
      const aPriority = priorityWeight[a.priority || 'none'];
      const bPriority = priorityWeight[b.priority || 'none'];

      return bPriority - aPriority;
    });

  // Group tasks by status for summary
  const taskSummary = {
    total: filteredTasks.length,
    completed: filteredTasks.filter((t) => t.completed).length,
    urgent: filteredTasks.filter((t) => t.priority === 'urgent' && !t.completed).length,
    dueToday: filteredTasks.filter((t) => {
      if (!t.dueDate || t.completed) return false;
      const today = new Date().toDateString();
      return new Date(t.dueDate).toDateString() === today;
    }).length,
    overdue: filteredTasks.filter((t) => {
      if (!t.dueDate || t.completed) return false;
      return new Date(t.dueDate) < new Date();
    }).length
  };

  // Group tasks by board for kanban view
  const tasksByBoard = filteredTasks.reduce(
    (acc, task) => {
      if (!acc[task.boardName]) acc[task.boardName] = [];
      acc[task.boardName].push(task);
      return acc;
    },
    {} as Record<string, ExtendedTask[]>
  );

  const handleTaskSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!editingTask) return;

    const formData = new FormData(e.currentTarget);
    const updates = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      priority: formData.get('priority') as ExtendedTask['priority'],
      dueDate: formData.get('dueDate') as string
    };

    void updateTaskMutation.mutate({
      taskId: editingTask.id,
      updates
    });
  };

  if (isLoading) {
    return (
      <Center minH="60vh">
        <Spinner size="xl" label="Loading tasks..." />
      </Center>
    );
  }

  return (
    <>
      {/* Move Task Dialog */}
      <Dialog.Root
        open={isMoveDialogOpen}
        onOpenChange={(details) => setIsMoveDialogOpen(details.open)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="500px">
            <VStack gap="6" alignItems="stretch" p="6">
              <VStack gap="1" alignItems="stretch">
                <Dialog.Title>Move Task</Dialog.Title>
                <Dialog.Description>
                  Move "{taskToMove?.title}" to a different board or column
                </Dialog.Description>
              </VStack>

              <VStack gap="4" alignItems="stretch">
                <Box>
                  <Text mb="2" fontWeight="medium">
                    Board
                  </Text>
                  <Select.Root
                    collection={createListCollection({
                      items: boards.map((b) => ({ label: b.name, value: b.id }))
                    })}
                    value={selectedTargetBoardId ? [selectedTargetBoardId] : []}
                    onValueChange={(details) => {
                      const newBoardId = details.value[0];
                      setSelectedTargetBoardId(newBoardId);
                      // Auto-select first column of new board
                      const board = boards.find((b) => b.id === newBoardId);
                      if (board && board.columns.length > 0) {
                        setSelectedTargetColumnId(board.columns[0].id);
                      }
                    }}
                  >
                    <Select.Trigger>
                      <Select.ValueText placeholder="Select board" />
                    </Select.Trigger>
                    <Select.Content>
                      {boards.map((board) => (
                        <Select.Item key={board.id} item={{ label: board.name, value: board.id }}>
                          {board.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Box>

                {selectedTargetBoardId && (
                  <Box>
                    <Text mb="2" fontWeight="medium">
                      Column
                    </Text>
                    <Select.Root
                      collection={createListCollection({
                        items:
                          boards
                            .find((b) => b.id === selectedTargetBoardId)
                            ?.columns.map((c) => ({ label: c.name, value: c.id })) || []
                      })}
                      value={selectedTargetColumnId ? [selectedTargetColumnId] : []}
                      onValueChange={(details) => setSelectedTargetColumnId(details.value[0])}
                    >
                      <Select.Trigger>
                        <Select.ValueText placeholder="Select column" />
                      </Select.Trigger>
                      <Select.Content>
                        {boards
                          .find((b) => b.id === selectedTargetBoardId)
                          ?.columns.map((column) => (
                            <Select.Item
                              key={column.id}
                              item={{ label: column.name, value: column.id }}
                            >
                              {column.name}
                            </Select.Item>
                          ))}
                      </Select.Content>
                    </Select.Root>
                  </Box>
                )}
              </VStack>

              <HStack gap="3" justifyContent="flex-end">
                <Dialog.CloseTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.CloseTrigger>
                <Button
                  variant="solid"
                  onClick={() => {
                    if (taskToMove && selectedTargetColumnId) {
                      moveTaskMutation.mutate({
                        taskId: taskToMove.id,
                        columnId: selectedTargetColumnId
                      });
                    }
                  }}
                  disabled={!selectedTargetColumnId || moveTaskMutation.isPending}
                  loading={moveTaskMutation.isPending}
                >
                  Move Task
                </Button>
              </HStack>
            </VStack>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <Box data-space={currentSpace} p={{ base: '2', md: '4' }}>
        {/* Header */}
        <VStack gap="6" justifyContent="flex-start" alignItems="stretch" w="full">
          <VStack gap="1" alignItems="start">
            <Heading size="2xl">Tasks</Heading>
            <Text color="fg.muted">Comprehensive view of all your tasks across all boards</Text>
          </VStack>

          {/* Summary Cards */}
          <Grid gap="4" w="full" columns={{ base: 2, sm: 3, md: 5 }}>
            <Box borderRadius="lg" p="4" bg="bg.muted">
              <VStack gap="1" justifyContent="flex-start">
                <Text color="fg.muted" fontSize="sm">
                  Total Tasks
                </Text>
                <Text fontSize="2xl" fontWeight="bold">
                  {taskSummary.total}
                </Text>
              </VStack>
            </Box>
            <Box borderRadius="lg" p="4" bg="bg.muted">
              <VStack gap="1" justifyContent="flex-start">
                <Text color="fg.muted" fontSize="sm">
                  Completed
                </Text>
                <Text color="green.default" fontSize="2xl" fontWeight="bold">
                  {taskSummary.completed}
                </Text>
              </VStack>
            </Box>
            <Box borderRadius="lg" p="4" bg="bg.muted">
              <VStack gap="1" justifyContent="flex-start">
                <Text color="fg.muted" fontSize="sm">
                  Urgent
                </Text>
                <Text color="red.default" fontSize="2xl" fontWeight="bold">
                  {taskSummary.urgent}
                </Text>
              </VStack>
            </Box>
            <Box borderRadius="lg" p="4" bg="bg.muted">
              <VStack gap="1" justifyContent="flex-start">
                <Text color="fg.muted" fontSize="sm">
                  Due Today
                </Text>
                <Text color="yellow.default" fontSize="2xl" fontWeight="bold">
                  {taskSummary.dueToday}
                </Text>
              </VStack>
            </Box>
            <Box borderRadius="lg" p="4" bg="bg.muted">
              <VStack gap="1" justifyContent="flex-start">
                <Text color="fg.muted" fontSize="sm">
                  Overdue
                </Text>
                <Text color="red.default" fontSize="2xl" fontWeight="bold">
                  {taskSummary.overdue}
                </Text>
              </VStack>
            </Box>
          </Grid>

          {/* Filters and Controls */}
          <Box borderRadius="lg" w="full" p={{ base: '3', md: '4' }} bg="bg.muted">
            <HStack gap="2" alignItems="center" flexWrap="wrap">
              {/* Search - grows to fill space */}
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                flex="1"
                minW="120px"
              />

              {/* Filters group that wraps together */}
              <HStack gap="2" flexWrap="wrap">
                <HStack flexWrap="nowrap">
                  {/* Priority Filter */}
                  <Select.Root
                    collection={createListCollection({
                      items: [
                        { label: 'All Priorities', value: 'all' },
                        { label: 'Urgent', value: 'urgent' },
                        { label: 'High', value: 'high' },
                        { label: 'Medium', value: 'medium' },
                        { label: 'Low', value: 'low' }
                      ]
                    })}
                    value={[filterPriority]}
                    onValueChange={(details) => setFilterPriority(details.value[0])}
                  >
                    <Select.Control>
                      <Select.Trigger>
                        <Select.ValueText placeholder="Priority" whiteSpace="nowrap" />
                      </Select.Trigger>
                    </Select.Control>
                    <Select.Positioner>
                      <Select.Content>
                        {createListCollection({
                          items: [
                            { label: 'All Priorities', value: 'all' },
                            { label: 'Urgent', value: 'urgent' },
                            { label: 'High', value: 'high' },
                            { label: 'Medium', value: 'medium' },
                            { label: 'Low', value: 'low' }
                          ]
                        }).items.map((item) => (
                          <Select.Item key={item.value} item={item}>
                            <Select.ItemText>{item.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Select.Root>

                  {/* Status Filter */}
                  <Select.Root
                    collection={createListCollection({
                      items: [
                        { label: 'All', value: 'all' },
                        { label: 'Active', value: 'active' },
                        { label: 'Done', value: 'completed' }
                      ]
                    })}
                    value={[filterStatus]}
                    onValueChange={(details) => setFilterStatus(details.value[0])}
                  >
                    <Select.Control>
                      <Select.Trigger>
                        <Select.ValueText placeholder="Status" whiteSpace="nowrap" />
                      </Select.Trigger>
                    </Select.Control>
                    <Select.Positioner>
                      <Select.Content>
                        {createListCollection({
                          items: [
                            { label: 'All', value: 'all' },
                            { label: 'Active', value: 'active' },
                            { label: 'Done', value: 'completed' }
                          ]
                        }).items.map((item) => (
                          <Select.Item key={item.value} item={item}>
                            <Select.ItemText>{item.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Select.Root>

                  {/* Board Filter */}
                  <Select.Root
                    collection={createListCollection({
                      items: [
                        { label: 'All Boards', value: 'all' },
                        ...(boards?.map((board) => ({ label: board.name, value: board.id })) || [])
                      ]
                    })}
                    value={[filterBoard]}
                    onValueChange={(details) => setFilterBoard(details.value[0])}
                  >
                    <Select.Control>
                      <Select.Trigger>
                        <Select.ValueText placeholder="Board" whiteSpace="nowrap" />
                      </Select.Trigger>
                    </Select.Control>
                    <Select.Positioner>
                      <Select.Content>
                        {createListCollection({
                          items: [
                            { label: 'All Boards', value: 'all' },
                            ...(boards?.map((board) => ({
                              label: board.name,
                              value: board.id
                            })) || [])
                          ]
                        }).items.map((item) => (
                          <Select.Item key={item.value} item={item}>
                            <Select.ItemText>{item.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Select.Root>
                </HStack>

                {/* View Mode Buttons */}
                <HStack gap="1">
                  <Button
                    variant={viewMode === 'list' ? 'solid' : 'outline'}
                    onClick={() => setViewMode('list')}
                    size="sm"
                  >
                    List
                  </Button>
                  <Button
                    variant={viewMode === 'kanban' ? 'solid' : 'outline'}
                    onClick={() => setViewMode('kanban')}
                    size="sm"
                  >
                    Boards
                  </Button>
                </HStack>
              </HStack>
            </HStack>
          </Box>

          {/* Task Views */}
          {viewMode === 'list' && (
            <Box w="full">
              <VStack gap="2" justifyContent="flex-start" w="full">
                {filteredTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    event={task as CalendarEvent}
                    onToggleComplete={() => {
                      updateTaskMutation.mutate({
                        taskId: task.id,
                        updates: {
                          completed: !task.completed
                        }
                      });
                    }}
                    onTaskClick={() => {
                      setEditingTask(task);
                      setIsTaskDialogOpen(true);
                    }}
                    extraBadges={
                      <>
                        <Badge size="sm" variant="outline">
                          {task.boardName}
                        </Badge>
                        <Badge size="sm" variant="subtle">
                          {task.columnName}
                        </Badge>
                      </>
                    }
                    actions={
                      <>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void navigate(`/board/${task.boardId}`);
                          }}
                          aria-label="View Board"
                        >
                          <LayoutGrid width="16" height="16" />
                        </IconButton>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setTaskToMove(task);
                            setSelectedTargetBoardId(task.boardId);
                            setSelectedTargetColumnId(task.columnId);
                            setIsMoveDialogOpen(true);
                          }}
                          aria-label="Move to board"
                          colorPalette="purple"
                        >
                          <MoveRight width="16" height="16" />
                        </IconButton>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            duplicateTaskMutation.mutate(task);
                          }}
                          aria-label="Duplicate task"
                          colorPalette="blue"
                        >
                          <Copy width="16" height="16" />
                        </IconButton>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this task?')) {
                              deleteTaskMutation.mutate(task.id);
                            }
                          }}
                          aria-label="Delete task"
                          colorPalette="red"
                        >
                          <Trash2 />
                        </IconButton>
                      </>
                    }
                  />
                ))}

                {filteredTasks.length === 0 && (
                  <Box w="full" p="8" textAlign="center">
                    <Text color="fg.muted">No tasks found matching your filters.</Text>
                  </Box>
                )}
              </VStack>
            </Box>
          )}

          {viewMode === 'kanban' && (
            <Box w="full">
              <HStack gap="6" justifyContent="flex-start" flexWrap="wrap">
                {Object.entries(tasksByBoard).map(([boardName, boardTasks]) => (
                  <Box key={boardName} borderRadius="lg" minW="300px" p="4" bg="bg.muted">
                    <Text mb="4" fontWeight="semibold">
                      {boardName} ({boardTasks.length})
                    </Text>
                    <VStack gap="2">
                      {boardTasks.map((task) => (
                        <Box
                          key={task.id}
                          borderColor="border.default"
                          borderRadius="md"
                          borderWidth="1px"
                          w="full"
                          p="3"
                          bg="bg.default"
                        >
                          <VStack gap="2" justifyContent="flex-start">
                            <Text fontSize="sm" fontWeight="medium">
                              {task.title}
                            </Text>
                            <HStack gap="2">
                              {task.priority && (
                                <PriorityBadge priority={task.priority} size="sm" />
                              )}
                              <Badge size="sm" variant="subtle">
                                {task.columnName}
                              </Badge>
                            </HStack>
                          </VStack>
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                ))}
              </HStack>
            </Box>
          )}
        </VStack>

        {/* Reusable Task Dialog */}
        <TaskDialog
          open={isTaskDialogOpen}
          onOpenChange={(isOpen) => {
            setIsTaskDialogOpen(isOpen);
            if (!isOpen) {
              setTimeout(() => setEditingTask(null), 200);
            }
          }}
          task={editingTask as Task | null}
          onSubmit={handleTaskSubmit}
          mode="edit"
        />
      </Box>
    </>
  );
}
