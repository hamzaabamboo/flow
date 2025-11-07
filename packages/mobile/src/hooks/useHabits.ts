import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/client';
import type { Habit, Space } from '@/types';

export const useHabits = (space: Space, date?: Date) => {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const dateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  const query = useQuery({
    queryKey: ['habits', space, dateStr],
    queryFn: async (): Promise<Habit[]> => {
      console.log('[useHabits] Fetching habits for space:', space, 'date:', dateStr);

      const { data, error } = await api.api.habits.get({
        query: { space, date: dateStr }
      });

      if (error) {
        console.error('[useHabits] Failed to fetch habits:', error);

        if (error.status === 401) {
          console.error('[useHabits] 401 Unauthorized - logging out');
          await logout();
          router.replace('/(auth)/login');
        }

        throw new Error(`Failed to fetch habits: ${error.status}`);
      }

      const habits = (data ?? []) as Habit[];
      console.log('[useHabits] Received habits:', habits.length);
      console.log('[useHabits] First habit:', habits[0]);
      console.log('[useHabits] Completed habits:', habits.filter(h => h.completedToday).length);
      return habits;
    },
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
