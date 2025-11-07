import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useSpaceStore } from '@/store/spaceStore';
import { api } from '@/api/client';

interface CommandResponse {
  intent: {
    action: string;
    task?: {
      title: string;
      description?: string;
      dueDate?: string;
      priority?: string;
      labels?: string[];
      boardId?: string;
      columnId?: string;
    };
  };
  message: string;
}

export const useExecuteCommand = () => {
  const queryClient = useQueryClient();
  const currentSpace = useSpaceStore((state) => state.currentSpace);

  return useMutation({
    mutationFn: async (command: string): Promise<CommandResponse> => {
      if (!currentSpace) throw new Error('No space selected');

      // First, parse the command
      // @ts-expect-error - Eden Treaty body typing broken by monorepo Elysia mismatch
      const { data: parsedIntent, error: parseError } = await api.api.command.post({
        command,
        space: currentSpace
      });

      if (parseError) {
        console.error('Parse command failed:', parseError.status);
        throw new Error(`Failed to parse command: ${parseError.status}`);
      }

      // Then execute the command
      // @ts-expect-error - Eden Treaty body typing broken by monorepo Elysia mismatch
      const { error: executeError } = await api.api.command.execute.post({
        ...parsedIntent,
        space: currentSpace
      });

      if (executeError) {
        console.error('Execute command failed:', executeError.status);
        throw new Error(`Failed to execute command: ${executeError.status}`);
      }

      return {
        intent: parsedIntent,
        message: 'Command executed successfully'
      };
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      console.error('Failed to execute command:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  });
};
