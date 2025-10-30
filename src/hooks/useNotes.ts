import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
      const response = await fetch('/api/notes/enabled', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to check notes status');
      return response.json() as Promise<{ enabled: boolean }>;
    },
    staleTime: Infinity // This rarely changes
  });
}

export function useTaskNote(taskId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['notes', 'task', taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const response = await fetch(`/api/notes/task/${taskId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch task note');
      const data = await response.json();
      return data.note as Note | null;
    },
    enabled: enabled && !!taskId
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateNoteParams) => {
      const response = await fetch('/api/notes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(params)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create note');
      }
      return response.json();
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
      const response = await fetch('/api/notes/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(params)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to search notes');
      }
      const data = await response.json();
      return data.documents as NoteDocument[];
    }
  });
}

export function useLinkNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: LinkNoteParams) => {
      const response = await fetch('/api/notes/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(params)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to link note');
      }
      return response.json();
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
      const response = await fetch(`/api/notes/unlink/${taskId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to unlink note');
      }
      return response.json();
    },
    onSuccess: (data, taskId) => {
      queryClient.invalidateQueries({ queryKey: ['notes', 'task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });
}
