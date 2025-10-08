import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { navigate } from 'vike/client/router';
import { LayoutGrid } from 'lucide-react';
import { useDialogs } from '../utils/useDialogs';
import { useSpace } from '../contexts/SpaceContext';
import type { CalendarEvent, ExtendedTask } from '../shared/types/calendar';
import type { Task } from '../shared/types';

interface UseTaskActionsOptions {
  onTaskEdit?: (task: CalendarEvent | ExtendedTask | Task) => void;
  onSuccess?: () => void;
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
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to delete task');
      return response.json();
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
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'GET',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch task');
      const fullTask = await response.json();

      // Create duplicate
      const payload: Record<string, unknown> = {
        title: `${fullTask.title} (Copy)`,
        completed: false
      };

      if (fullTask.columnId) payload.columnId = fullTask.columnId;
      if (fullTask.description) payload.description = fullTask.description;
      if (fullTask.priority) payload.priority = fullTask.priority;
      if (fullTask.dueDate) payload.dueDate = fullTask.dueDate;
      if (fullTask.labels?.length) payload.labels = fullTask.labels;
      if (fullTask.subtasks?.length) {
        payload.subtasks = fullTask.subtasks.map((st: { title: string }) => ({
          title: st.title,
          completed: false
        }));
      }
      if (fullTask.link) payload.link = fullTask.link;

      const duplicateResponse = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!duplicateResponse.ok) throw new Error('Failed to duplicate task');
      return duplicateResponse.json();
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
