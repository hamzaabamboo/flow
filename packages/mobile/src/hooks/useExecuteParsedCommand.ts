import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useSpaceStore } from '@/store/spaceStore';
import { api } from '@/api/client';
import type { ParsedIntent } from './useParseCommand';

export const useExecuteParsedCommand = () => {
  const queryClient = useQueryClient();
  const currentSpace = useSpaceStore((state) => state.currentSpace);

  return useMutation({
    mutationFn: async (intent: ParsedIntent): Promise<{ message: string }> => {
      if (!currentSpace) throw new Error('No space selected');

      // @ts-expect-error - Eden Treaty body typing broken by monorepo Elysia mismatch
      const { error } = await api.api.command.execute.post({
        ...intent,
        space: currentSpace
      });

      if (error) {
        throw new Error(`Failed to execute command: ${error.status}`);
      }

      return { message: 'Command executed successfully' };
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
    onError: (error) => {
      console.error('Failed to execute command:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  });
};
