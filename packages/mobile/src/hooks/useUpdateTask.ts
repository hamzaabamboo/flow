import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '@/api/client';
import type { Task } from '@/types';

interface UpdateTaskInput {
  taskId: string;
  updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>;
}

export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, updates }: UpdateTaskInput) => {
      console.log('[useUpdateTask] Updating task:', taskId, updates);

      const { data, error } = await api.api.tasks[taskId].patch(updates);

      if (error) {
        console.error('[useUpdateTask] Failed to update task:', error);
        throw new Error(`Failed to update task: ${error.status}`);
      }

      console.log('[useUpdateTask] Task updated successfully');
      return data;
    },
    onSuccess: (data, variables) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Invalidate both the specific task and the agenda list
      queryClient.invalidateQueries({ queryKey: ['task', variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      console.error('Failed to update task:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  });
};
