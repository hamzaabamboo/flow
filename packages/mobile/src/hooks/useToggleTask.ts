import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '@/api/client';

interface ToggleTaskParams {
  taskId: string;
  instanceDate?: string | Date;
}

export const useToggleTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, instanceDate }: ToggleTaskParams) => {
      // First get the task to toggle its state
      const { data: task, error: getError } = await api.api.tasks({ id: taskId }).get();

      if (getError) throw new Error('Failed to get task');

      // Build payload
      const payload: { completed: boolean; instanceDate?: string } = {
        completed: !task.completed
      };

      // Add instanceDate if provided (for recurring tasks)
      if (instanceDate) {
        payload.instanceDate =
          instanceDate instanceof Date ? instanceDate.toISOString().split('T')[0] : instanceDate;
      }

      // Toggle completed state
      const { data, error: patchError } = await api.api.tasks({ id: taskId }).patch(payload);

      if (patchError) throw new Error('Failed to toggle task');

      return data;
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      console.error('Failed to toggle task:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  });
};
