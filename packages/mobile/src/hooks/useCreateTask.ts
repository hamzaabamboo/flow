import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '@/api/client';
import type { Space } from '@/types';

interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  space: Space;
  columnId?: string;
}

export const useCreateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      console.log('[useCreateTask] Creating task:', input);

      // If no columnId is provided, we need to get the default board and its first column
      let columnId = input.columnId;

      if (!columnId) {
        // Fetch boards for the space
        const { data: boards, error: boardsError } = await api.api.boards.get({
          query: { space: input.space }
        });

        if (boardsError || !boards || boards.length === 0) {
          throw new Error('No boards found for this space');
        }

        // Get the first board
        const firstBoard = boards[0];

        // Fetch columns for the board
        const { data: columns, error: columnsError } =
          await api.api.boards[firstBoard.id].columns.get();

        if (columnsError || !columns || columns.length === 0) {
          throw new Error('No columns found for this board');
        }

        // Use the first column (usually "To Do" or "Backlog")
        columnId = columns[0].id;
      }

      const { data, error } = await api.api.tasks.post({
        columnId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueDate: input.dueDate
      });

      if (error) {
        console.error('[useCreateTask] Failed to create task:', error);
        throw new Error(`Failed to create task: ${error.status}`);
      }

      console.log('[useCreateTask] Task created successfully');
      return data;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      console.error('Failed to create task:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  });
};
