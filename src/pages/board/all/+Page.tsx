import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit2, Trash2, CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { Portal } from '@ark-ui/react/portal';
import { useSpace } from '../../../contexts/SpaceContext';
import { TaskDialog } from '../../../components/Board/TaskDialog';
import { Input } from '../../../components/ui/input';
import { Select, createListCollection } from '../../../components/ui/select';
import { IconButton } from '../../../components/ui/icon-button';
import { Text } from '../../../components/ui/text';
import { Heading } from '../../../components/ui/heading';
import { Badge } from '../../../components/ui/badge';
import { Countdown } from '../../../components/ui/countdown';
import type { Task, BoardWithColumns as Board } from '../../../shared/types/board';
import { Spinner } from '../../../components/ui/spinner';
import { Box, VStack, HStack, Center } from 'styled-system/jsx';

export default function AllTasksPage() {
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [filterColumn, setFilterColumn] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all boards for current space
  const { data: boards = [] } = useQuery<Board[]>({
    queryKey: ['boards', currentSpace],
    queryFn: async () => {
      const response = await fetch(`/api/boards?space=${currentSpace}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch boards');
      return response.json();
    }
  });

  // Fetch all tasks from all boards
  const { data: allTasks = [], isLoading } = useQuery<
    (Task & { boardName: string; columnName: string })[]
  >({
    queryKey: ['all-tasks', currentSpace],
    queryFn: async () => {
      if (boards.length === 0) return [];

      const allTasksPromises = boards.map(async (board: Board) => {
        const tasksPromises = board.columns.map(async (column) => {
          const response = await fetch(`/api/tasks/${column.id}`, {
            credentials: 'include'
          });
          if (!response.ok) return [];
          const tasks = await response.json();
          return tasks.map((task: Task) => ({
            ...task,
            columnId: column.id,
            boardName: board.name,
            columnName: column.name
          }));
        });

        const tasksByColumn = await Promise.all(tasksPromises);
        return tasksByColumn.flat();
      });

      const tasksByBoard = await Promise.all(allTasksPromises);
      return tasksByBoard.flat();
    },
    enabled: boards.length > 0
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
      queryClient.invalidateQueries({ queryKey: ['all-tasks', currentSpace] });
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
      queryClient.invalidateQueries({ queryKey: ['all-tasks', currentSpace] });
    }
  });

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
    }
  };

  const toggleTaskComplete = (task: Task) => {
    updateTaskMutation.mutate({
      taskId: task.id,
      updates: { completed: !task.completed }
    });
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

  const getPriorityIcon = (priority?: string) => {
    if (priority === 'urgent' || priority === 'high') {
      return <AlertCircle width="16" height="16" />;
    }
    return null;
  };

  // Extract all unique columns for filter
  const allColumns = boards
    .flatMap((board) =>
      board.columns.map((col) => ({
        id: col.id,
        name: col.name,
        boardName: board.name,
        boardId: board.id
      }))
    )
    .sort((a, b) => `${a.boardName} - ${a.name}`.localeCompare(`${b.boardName} - ${b.name}`));

  // Filter tasks based on search and filters
  const filteredTasks = allTasks.filter((task) => {
    const matchesSearch =
      searchTerm === '' ||
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesColumn = filterColumn === 'all' || task.columnId === filterColumn;
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;

    return matchesSearch && matchesColumn && matchesPriority;
  });

  // Group tasks by status
  const groupedTasks = {
    todo: filteredTasks.filter((t) => !t.completed && t.columnName === 'To Do'),
    inProgress: filteredTasks.filter((t) => !t.completed && t.columnName === 'In Progress'),
    done: filteredTasks.filter((t) => t.completed || t.columnName === 'Done'),
    other: filteredTasks.filter(
      (t) => !t.completed && !['To Do', 'In Progress', 'Done'].includes(t.columnName)
    )
  };

  if (isLoading) {
    return (
      <Center minH="60vh">
        <Spinner size="xl" label="Loading tasks..." />
      </Center>
    );
  }

  return (
    <Box data-space={currentSpace} minHeight="calc(100vh - 128px)">
      {/* Header */}
      <Box borderColor="border.default" borderBottomWidth="1px" bg="bg.default">
        <VStack gap="4" p="6">
          <HStack justifyContent="space-between" alignItems="center" w="full">
            <HStack gap="4">
              <Heading size="2xl" color="fg.default">
                All Tasks
              </Heading>
              <Badge data-space={currentSpace}>{filteredTasks.length} tasks</Badge>
            </HStack>
          </HStack>

          {/* Filters */}
          <HStack gap="4" w="full">
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              maxW="300px"
            />

            <Select.Root
              collection={createListCollection({
                items: [
                  { label: 'All columns', value: 'all' },
                  ...allColumns.map((col) => ({
                    label: `${col.boardName} - ${col.name}`,
                    value: col.id
                  }))
                ]
              })}
              value={[filterColumn]}
              onValueChange={(details) => setFilterColumn(details.value[0])}
            >
              <Select.Control>
                <Select.Trigger w="250px">
                  <Select.ValueText placeholder="All columns" />
                </Select.Trigger>
              </Select.Control>
              <Portal>
                <Select.Positioner>
                  <Select.Content>
                    {createListCollection({
                      items: [
                        { label: 'All columns', value: 'all' },
                        ...allColumns.map((col) => ({
                          label: `${col.boardName} - ${col.name}`,
                          value: col.id
                        }))
                      ]
                    }).items.map((item) => (
                      <Select.Item key={item.value} item={item}>
                        <Select.ItemText>{item.label}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>

            <Select.Root
              collection={createListCollection({
                items: [
                  { label: 'All priorities', value: 'all' },
                  { label: 'Low', value: 'low' },
                  { label: 'Medium', value: 'medium' },
                  { label: 'High', value: 'high' },
                  { label: 'Urgent', value: 'urgent' }
                ]
              })}
              value={[filterPriority]}
              onValueChange={(details) => setFilterPriority(details.value[0])}
            >
              <Select.Control>
                <Select.Trigger w="200px">
                  <Select.ValueText placeholder="All priorities" />
                </Select.Trigger>
              </Select.Control>
              <Portal>
                <Select.Positioner>
                  <Select.Content>
                    {createListCollection({
                      items: [
                        { label: 'All priorities', value: 'all' },
                        { label: 'Low', value: 'low' },
                        { label: 'Medium', value: 'medium' },
                        { label: 'High', value: 'high' },
                        { label: 'Urgent', value: 'urgent' }
                      ]
                    }).items.map((item) => (
                      <Select.Item key={item.value} item={item}>
                        <Select.ItemText>{item.label}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>
          </HStack>
        </VStack>
      </Box>

      {/* Task List */}
      <Box p="6">
        <VStack gap="6" alignItems="stretch">
          {/* To Do Section */}
          {groupedTasks.todo.length > 0 && (
            <Box>
              <Text mb="3" color="fg.muted" fontSize="sm" fontWeight="semibold">
                TO DO ({groupedTasks.todo.length})
              </Text>
              <VStack gap="2">
                {groupedTasks.todo.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    columnName={task.columnName}
                    boardName={task.boardName}
                    onToggleComplete={() => toggleTaskComplete(task)}
                    onEdit={() => {
                      setEditingTask(task);
                      setIsTaskDialogOpen(true);
                    }}
                    onDelete={() => deleteTaskMutation.mutate(task.id)}
                    getPriorityColor={getPriorityColor}
                    getPriorityIcon={getPriorityIcon}
                  />
                ))}
              </VStack>
            </Box>
          )}

          {/* In Progress Section */}
          {groupedTasks.inProgress.length > 0 && (
            <Box>
              <Text mb="3" color="fg.muted" fontSize="sm" fontWeight="semibold">
                IN PROGRESS ({groupedTasks.inProgress.length})
              </Text>
              <VStack gap="2">
                {groupedTasks.inProgress.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    columnName={task.columnName}
                    boardName={task.boardName}
                    onToggleComplete={() => toggleTaskComplete(task)}
                    onEdit={() => {
                      setEditingTask(task);
                      setIsTaskDialogOpen(true);
                    }}
                    onDelete={() => deleteTaskMutation.mutate(task.id)}
                    getPriorityColor={getPriorityColor}
                    getPriorityIcon={getPriorityIcon}
                  />
                ))}
              </VStack>
            </Box>
          )}

          {/* Other Columns */}
          {groupedTasks.other.length > 0 && (
            <Box>
              <Text mb="3" color="fg.muted" fontSize="sm" fontWeight="semibold">
                OTHER ({groupedTasks.other.length})
              </Text>
              <VStack gap="2">
                {groupedTasks.other.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    columnName={task.columnName}
                    boardName={task.boardName}
                    onToggleComplete={() => toggleTaskComplete(task)}
                    onEdit={() => {
                      setEditingTask(task);
                      setIsTaskDialogOpen(true);
                    }}
                    onDelete={() => deleteTaskMutation.mutate(task.id)}
                    getPriorityColor={getPriorityColor}
                    getPriorityIcon={getPriorityIcon}
                  />
                ))}
              </VStack>
            </Box>
          )}

          {/* Done Section */}
          {groupedTasks.done.length > 0 && (
            <Box>
              <Text mb="3" color="fg.muted" fontSize="sm" fontWeight="semibold">
                DONE ({groupedTasks.done.length})
              </Text>
              <VStack gap="2">
                {groupedTasks.done.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    columnName={task.columnName}
                    boardName={task.boardName}
                    onToggleComplete={() => toggleTaskComplete(task)}
                    onEdit={() => {
                      setEditingTask(task);
                      setIsTaskDialogOpen(true);
                    }}
                    onDelete={() => deleteTaskMutation.mutate(task.id)}
                    getPriorityColor={getPriorityColor}
                    getPriorityIcon={getPriorityIcon}
                  />
                ))}
              </VStack>
            </Box>
          )}

          {filteredTasks.length === 0 && (
            <Box py="12" textAlign="center">
              <Text color="fg.muted">No tasks found</Text>
            </Box>
          )}
        </VStack>
      </Box>

      {/* Reusable Task Dialog */}
      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={(isOpen) => {
          setIsTaskDialogOpen(isOpen);
          if (!isOpen) {
            setTimeout(() => setEditingTask(null), 200);
          }
        }}
        task={editingTask}
        onSubmit={handleTaskSubmit}
        mode="edit"
        columns={allColumns.map((col) => ({
          id: col.id,
          name: `${col.boardName} - ${col.name}`,
          boardId: col.boardId,
          taskOrder: []
        }))}
      />
    </Box>
  );
}

function TaskRow({
  task,
  columnName,
  boardName,
  onToggleComplete,
  onEdit,
  onDelete,
  getPriorityColor,
  getPriorityIcon
}: {
  task: Task & { boardName: string; columnName: string };
  columnName: string;
  boardName: string;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  getPriorityColor: (priority?: string) => string;
  getPriorityIcon: (priority?: string) => React.ReactNode;
}) {
  return (
    <Box
      borderColor="border.default"
      borderRadius="lg"
      borderWidth="1px"
      p="4"
      bg="bg.default"
      transition="all 0.2s"
      _hover={{ borderColor: 'colorPalette.default' }}
    >
      <HStack justifyContent="space-between" alignItems="flex-start">
        <HStack flex="1" gap="3">
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onToggleComplete}
            aria-label={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {task.completed ? (
              <CheckCircle width="20" height="20" />
            ) : (
              <Circle width="20" height="20" />
            )}
          </IconButton>

          <VStack flex="1" gap="1" alignItems="flex-start">
            <Text
              color={task.completed ? 'fg.muted' : 'fg.default'}
              textDecoration={task.completed ? 'line-through' : undefined}
              fontSize="sm"
              fontWeight="medium"
            >
              {task.title}
            </Text>
            {task.description && (
              <Text color="fg.muted" fontSize="xs">
                {task.description}
              </Text>
            )}
            <HStack gap="2" flexWrap="wrap">
              <Badge size="sm" variant="outline">
                {boardName}
              </Badge>
              <Badge size="sm" colorPalette="gray">
                {columnName}
              </Badge>
              {task.priority && (
                <Badge size="sm" colorPalette={getPriorityColor(task.priority)}>
                  <HStack gap="1">
                    {getPriorityIcon(task.priority)}
                    {task.priority}
                  </HStack>
                </Badge>
              )}
              {task.dueDate && <Countdown targetDate={task.dueDate} size="sm" />}
            </HStack>
          </VStack>
        </HStack>

        <HStack gap="1">
          <IconButton variant="ghost" size="sm" onClick={onEdit} aria-label="Edit task">
            <Edit2 width="16" height="16" />
          </IconButton>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onDelete}
            aria-label="Delete task"
            colorPalette="red"
          >
            <Trash2 width="16" height="16" />
          </IconButton>
        </HStack>
      </HStack>
    </Box>
  );
}
