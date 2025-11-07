import { useMutation } from '@tanstack/react-query';
import { useSpaceStore } from '@/store/spaceStore';
import { api } from '@/api/client';

export interface ParsedIntent {
  action: string;
  task?: {
    title: string;
    description?: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    labels?: string[];
    boardId?: string;
    columnId?: string;
  };
  habit?: {
    name: string;
    description?: string;
    frequency?: string;
  };
}

export const useParseCommand = () => {
  const currentSpace = useSpaceStore((state) => state.currentSpace);

  return useMutation({
    mutationFn: async (command: string): Promise<ParsedIntent> => {
      if (!currentSpace) throw new Error('No space selected');

      const { data, error } = await api.api.command.post({
        command,
        space: currentSpace
      });

      if (error) {
        throw new Error(`Failed to parse command: ${error.status}`);
      }

      return data as ParsedIntent;
    }
  });
};
