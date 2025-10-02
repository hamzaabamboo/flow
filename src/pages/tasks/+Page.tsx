import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { navigate } from 'vike/client/router';
import { Trash2, LayoutGrid } from 'lucide-react';
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
  const { data: boards = [] } = useQuery<Array<{ id: string; name: string }>>({
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
            <HStack gap="2" flexWrap="nowrap">
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
                  <Select.Trigger minW="130px">
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
                  <Select.Trigger minW="90px">
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
                  <Select.Trigger minW="130px">
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
                            {task.priority && <PriorityBadge priority={task.priority} size="sm" />}
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
  );
}
