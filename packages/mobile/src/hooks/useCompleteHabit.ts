import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '@/api/client';

interface CompleteHabitParams {
  habitId: string;
  date: Date;
  completed: boolean;
}

export const useCompleteHabit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId, date, completed }: CompleteHabitParams) => {
      console.log('[useCompleteHabit] Toggling habit:', habitId, 'for date:', date, 'completed:', completed);

      // Format date as YYYY-MM-DD
      const dateStr = date.toISOString().split('T')[0];

      // Use the correct endpoint: POST /api/habits/{id}/log
      const { data, error } = await api.api.habits({ id: habitId }).log.post({
        date: dateStr,
        completed
      });

      if (error) {
        console.error('[useCompleteHabit] Failed to toggle habit:', error);
        throw new Error(`Failed to toggle habit: ${error.status}`);
      }

      console.log('[useCompleteHabit] Habit toggled successfully');
      return data;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
    },
    onError: (error) => {
      console.error('Failed to complete habit:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  });
};
