import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/client';
import type { Task } from '@/types';

export const useTaskDetail = (taskId: string | undefined) => {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const query = useQuery({
    queryKey: ['task', taskId],
    queryFn: async (): Promise<Task> => {
      if (!taskId) {
        throw new Error('Task ID is required');
      }

      console.log('[useTaskDetail] Fetching task:', taskId);

      const { data, error } = await api.api.tasks[taskId].get();

      if (error) {
        console.error('[useTaskDetail] Failed to fetch task:', error);

        if (error.status === 401) {
          console.error('[useTaskDetail] 401 Unauthorized - logging out');
          await logout();
          router.replace('/(auth)/login');
        }

        throw new Error(`Failed to fetch task: ${error.status}`);
      }

      console.log('[useTaskDetail] Received task:', data);
      return data as Task;
    },
    enabled: !!taskId,
    retry: (failureCount, error) => {
      // Don't retry on 401
      if (error.message.includes('401')) {
        return false;
      }
      return failureCount < 3;
    }
  });

  return query;
};
