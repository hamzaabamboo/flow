import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

interface CreateNoteParams {
  title: string;
  text?: string;
  taskId?: string;
  collectionId?: string;
}

interface LinkNoteParams {
  taskId: string;
  noteId: string;
}

interface SearchNotesParams {
  query: string;
  limit?: number;
  offset?: number;
  collectionId?: string;
}

interface NoteDocument {
  id: string;
  title: string;
  url: string;
  context?: string;
  ranking?: number;
  updatedAt: string;
}

interface Note {
  id: string;
  title: string | null;
  url: string | null;
}

export function useNotesEnabled() {
  return useQuery({
    queryKey: ['notes', 'enabled'],
    queryFn: async () => {
      const { data, error } = await api.api.notes.enabled.get();
      if (error) throw new Error('Failed to check notes status');
      return data as { enabled: boolean };
    },
    staleTime: Infinity // This rarely changes
  });
}

export function useTaskNote(taskId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['notes', 'task', taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const { data, error } = await api.api.notes.task({ taskId }).get();
      if (error) throw new Error('Failed to fetch task note');
      return data.note as Note | null;
    },
    enabled: enabled && !!taskId
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateNoteParams) => {
      const { data, error } = await api.api.notes.create.post(params);
      if (error) {
        throw new Error(error.value?.message || 'Failed to create note');
      }
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate task note query if note was linked to a task
      if (variables.taskId) {
        queryClient.invalidateQueries({ queryKey: ['notes', 'task', variables.taskId] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
    }
  });
}

export function useSearchNotes() {
  return useMutation({
    mutationFn: async (params: SearchNotesParams) => {
      const { data, error } = await api.api.notes.search.post(params);
      if (error) {
        throw new Error(error.value?.message || 'Failed to search notes');
      }
      return data.documents as NoteDocument[];
    }
  });
}

export function useLinkNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: LinkNoteParams) => {
      const { data, error } = await api.api.notes.link.post(params);
      if (error) {
        throw new Error(error.value?.message || 'Failed to link note');
      }
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes', 'task', variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });
}

export function useUnlinkNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await api.api.notes.unlink({ taskId }).delete();
      if (error) {
        throw new Error(error.value?.message || 'Failed to unlink note');
      }
      return data;
    },
    onSuccess: (data, taskId) => {
      queryClient.invalidateQueries({ queryKey: ['notes', 'task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });
}
