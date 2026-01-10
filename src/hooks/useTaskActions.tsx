import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid } from 'lucide-react';
import { navigate } from 'vike/client/router';
import { useDialogs } from '../utils/useDialogs';
import { useSpace } from '../contexts/SpaceContext';
import type { CalendarEvent, ExtendedTask, Task } from '../shared/types';
import { api } from '../api/client';

interface UseTaskActionsOptions {
  onTaskEdit?: (task: CalendarEvent | ExtendedTask | Task) => void;
  onSuccess?: () => void;
}

interface CreateTaskPayload {
  title: string;
  completed?: boolean;
  columnId?: string;
  description?: string;
  priority?: string;
  dueDate?: string;
  labels?: string[];
  subtasks?: { title: string; completed: boolean }[];
  link?: string;
}

export function useTaskActions(options: UseTaskActionsOptions = {}) {
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();
  const { confirm } = useDialogs();
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [taskToMove, setTaskToMove] = useState<CalendarEvent | ExtendedTask | Task | null>(null);

  // Delete mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await api.api.tasks({ id: taskId }).delete();
      if (error) throw new Error('Failed to delete task');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTasks', currentSpace] });
      queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] });
      queryClient.invalidateQueries({ queryKey: ['boards', currentSpace] });
      options.onSuccess?.();
    }
  });

  // Duplicate mutation
  const duplicateTaskMutation = useMutation({
    mutationFn: async (task: CalendarEvent | ExtendedTask | Task) => {
      // Fetch full task data
      const { data: fullTask, error: fetchError } = await api.api.tasks({ id: task.id }).get();
      if (fetchError || !fullTask || 'error' in fullTask) {
        throw new Error('Failed to fetch task');
      }

      // Create duplicate
      const payload: CreateTaskPayload = {
        title: `${fullTask.title} (Copy)`,
        completed: false
      };

      if (fullTask.columnId) payload.columnId = fullTask.columnId;
      if (fullTask.description) payload.description = fullTask.description;
      if (fullTask.priority) payload.priority = fullTask.priority;
      if (fullTask.dueDate) payload.dueDate = fullTask.dueDate.toISOString();
      if (fullTask.labels?.length) payload.labels = fullTask.labels;
      if (fullTask.subtasks?.length) {
        payload.subtasks = fullTask.subtasks.map((st) => ({
          title: st.title,
          completed: false
        }));
      }
      if ('link' in fullTask && fullTask.link) payload.link = fullTask.link as string;

      const { data, error } = await api.api.tasks.post(payload);
      if (error) throw new Error('Failed to duplicate task');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTasks', currentSpace] });
      queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] });
      queryClient.invalidateQueries({ queryKey: ['boards', currentSpace] });
      options.onSuccess?.();
    }
  });

  // Move mutation
  const moveTaskMutation = useMutation({
    mutationFn: async ({ taskId, columnId }: { taskId: string; columnId: string }) => {
      const { data, error } = await api.api.tasks({ id: taskId }).patch({ columnId });
      if (error) throw new Error('Failed to move task');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTasks', currentSpace] });
      queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] });
      queryClient.invalidateQueries({ queryKey: ['boards', currentSpace] });
      setIsMoveDialogOpen(false);
      setTaskToMove(null);
      options.onSuccess?.();
    }
  });

  // Action handlers
  const handleEdit = (task: CalendarEvent | ExtendedTask | Task) => {
    options.onTaskEdit?.(task);
  };

  const handleDelete = (task: CalendarEvent | ExtendedTask | Task) => {
    void (async () => {
      const confirmed = await confirm({
        title: 'Delete Task',
        description: 'Are you sure you want to delete this task? This action cannot be undone.',
        confirmText: 'Delete',
        variant: 'danger'
      });
      if (confirmed) {
        deleteTaskMutation.mutate(task.id);
      }
    })();
  };

  const handleDuplicate = (task: CalendarEvent | ExtendedTask | Task) => {
    duplicateTaskMutation.mutate(task);
  };

  const handleMove = (task: CalendarEvent | ExtendedTask | Task) => {
    setTaskToMove(task);
    setIsMoveDialogOpen(true);
  };

  const handleViewBoard = (task: CalendarEvent | ExtendedTask | Task) => {
    const boardId = (task as ExtendedTask).boardId;
    if (boardId) {
      void navigate(`/board/${boardId}`);
    }
  };

  // Extra actions for TaskActionsMenu
  const extraActions = [
    {
      value: 'view-board',
      label: 'View Board',
      icon: <LayoutGrid width="16" height="16" />,
      onClick: handleViewBoard
    }
  ];

  return {
    // Action handlers
    handleEdit,
    handleDelete,
    handleDuplicate,
    handleMove,
    handleViewBoard,

    // Extra actions for menu
    extraActions,

    // Move dialog state
    isMoveDialogOpen,
    setIsMoveDialogOpen,
    taskToMove,
    setTaskToMove,
    moveTaskMutation,

    // Mutation states
    isDeleting: deleteTaskMutation.isPending,
    isDuplicating: duplicateTaskMutation.isPending,
    isMoving: moveTaskMutation.isPending
  };
}
