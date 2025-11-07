import { useQuery } from '@tanstack/react-query';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { useRouter } from 'expo-router';
import { useSpaceStore } from '@/store/spaceStore';
import { api, handle401 } from '@/api/client';
import type { CalendarEvent } from '@/types';
import { isTaskCompleted } from '@hamflow/shared';

export const useAgendaTasks = (view: 'day' | 'week', date: Date = new Date()) => {
  const { currentSpace } = useSpaceStore();
  const router = useRouter();

  const startDate = view === 'day' ? startOfDay(date) : startOfWeek(date);
  const endDate = view === 'day' ? endOfDay(date) : endOfWeek(date);

  console.log('[useAgendaTasks] Hook params:', {
    view,
    currentSpace,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });

  const query = useQuery({
    queryKey: ['agenda', view, format(date, 'yyyy-MM-dd'), currentSpace],
    queryFn: async (): Promise<CalendarEvent[]> => {
      console.log('[useAgendaTasks] Fetching tasks...', { view, currentSpace });

      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);

      const { data, error } = await api.api.calendar.events.get({
        query: {
          start: startTimestamp.toString(),
          end: endTimestamp.toString(),
          space: currentSpace,
          includeOverdue: 'true'
        }
      });

      console.log('[useAgendaTasks] Response status:', error ? error.status : 'success');

      if (error) {
        if (error.status === 401) {
          console.error('[useAgendaTasks] 401 Unauthorized - logging out');
          await handle401();
          router.replace('/(auth)/login');
          throw new Error('Session expired, please login again');
        }

        console.error('[useAgendaTasks] Failed to fetch tasks:', error.status);
        throw new Error(`${error.status}`);
      }

      const events = (data as any[]).map((event) => ({
        ...event,
        // Use the same completion logic as the web frontend
        completed: isTaskCompleted(event)
      })) as CalendarEvent[];

      console.log('[useAgendaTasks] Received tasks:', events.length, 'tasks');
      console.log('[useAgendaTasks] First task:', events[0]);
      console.log('[useAgendaTasks] Completed tasks:', events.filter((e) => e.completed).length);
      return events;
    },
    enabled: !!currentSpace,
    retry: (failureCount, error) => {
      // Don't retry on 401
      if (error.message.includes('Session expired')) {
        return false;
      }
      return failureCount < 3;
    }
  });

  return query;
};
