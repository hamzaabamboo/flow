import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/client';
import type { Board, Space } from '@/types';

export const useBoards = (space?: Space) => {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const query = useQuery({
    queryKey: ['boards', space],
    queryFn: async (): Promise<Board[]> => {
      console.log('[useBoards] Fetching boards for space:', space);

      const { data, error } = await api.api.boards.get({
        query: space ? { space } : undefined
      });

      if (error) {
        console.error('[useBoards] Failed to fetch boards:', error);

        if (error.status === 401) {
          console.error('[useBoards] 401 Unauthorized - logging out');
          await logout();
          router.replace('/(auth)/login');
        }

        throw new Error(`Failed to fetch boards: ${error.status}`);
      }

      console.log('[useBoards] Received boards:', data?.length ?? 0);
      return (data ?? []) as Board[];
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
