import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AutoOrganizeRequest,
  AutoOrganizeResponse,
  AutoOrganizeSuggestion
} from '../../shared/types/autoOrganize';

export function useAutoOrganize() {
  return useMutation<AutoOrganizeResponse, Error, AutoOrganizeRequest>({
    mutationFn: async (request) => {
      const response = await fetch('/api/tasks/auto-organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error('Failed to generate organization suggestions');
      }

      return response.json();
    }
  });
}

export function useApplyAutoOrganize() {
  const queryClient = useQueryClient();

  return useMutation<
    { applied: number; failed: number; errors?: Array<{ taskId: string; error: string }> },
    Error,
    AutoOrganizeSuggestion[]
  >({
    mutationFn: async (suggestions) => {
      // Apply each suggestion as a PATCH request to /api/tasks/:id
      const results = await Promise.allSettled(
        suggestions.map(async (suggestion) => {
          const updates: Record<string, unknown> = {};

          switch (suggestion.details.type) {
            case 'column_move':
              updates.columnId = suggestion.details.suggestedColumnId;
              break;
            case 'priority_change':
              updates.priority = suggestion.details.suggestedPriority;
              break;
            case 'due_date_adjust':
              updates.dueDate = suggestion.details.suggestedDueDate;
              break;
          }

          const response = await fetch(`/api/tasks/${suggestion.taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updates)
          });

          if (!response.ok) {
            throw new Error(`Failed to update task ${suggestion.taskId}`);
          }

          return { taskId: suggestion.taskId, success: true };
        })
      );

      // Count successes and failures
      const applied = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r, index) => ({
          taskId: suggestions[index].taskId,
          error: r.reason?.message || 'Unknown error'
        }));

      return { applied, failed, errors: errors.length > 0 ? errors : undefined };
    },
    onSuccess: () => {
      // Invalidate relevant queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    }
  });
}
