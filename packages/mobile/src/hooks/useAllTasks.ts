import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/client';
import type { Task, Space } from '@/types';

interface UseAllTasksOptions {
  space?: Space;
  status?: 'todo' | 'in_progress' | 'completed';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export const useAllTasks = (options: UseAllTasksOptions = {}) => {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const query = useQuery({
    queryKey: ['all-tasks', options],
    queryFn: async (): Promise<Task[]> => {
      console.log('[useAllTasks] Fetching all tasks with options:', options);

      const { data: boards, error: boardsError } = await api.api.boards.get(
        options.space ? { query: { space: options.space } } : undefined
      );

      if (boardsError) {
        console.error('[useAllTasks] Failed to fetch boards:', boardsError);

        if (boardsError.status === 401) {
          await logout();
          router.replace('/(auth)/login');
        }

        throw new Error(`Failed to fetch boards: ${boardsError.status}`);
      }

      if (!boards || boards.length === 0) {
        return [];
      }

      // Fetch tasks from all boards in parallel
      const allTasks: Task[] = [];

      const boardResults = await Promise.all(
        boards.map(async (board) => {
          const { data: columns, error: columnsError } =
            await api.api.boards[board.id].columns.get();

          if (columnsError || !columns) return [];

          const columnResults = await Promise.all(
            columns.map(async (column) => {
              const { data: tasks, error: tasksError } =
                await api.api.columns[column.id].tasks.get();

              if (tasksError || !tasks) return [];

              return tasks as Task[];
            })
          );

          return columnResults.flat();
        })
      );

      allTasks.push(...boardResults.flat());

      // Apply client-side filters
      let filteredTasks = allTasks;

      if (options.priority) {
        filteredTasks = filteredTasks.filter((task) => task.priority === options.priority);
      }

      console.log('[useAllTasks] Received tasks:', filteredTasks.length);
      return filteredTasks;
    },
    retry: (failureCount, error) => {
      if (error.message.includes('401')) {
        return false;
      }
      return failureCount < 3;
    }
  });

  return query;
};
