import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useNotesEnabled,
  useTaskNote,
  useCreateNote,
  useSearchNotes,
  useLinkNote,
  useUnlinkNote
} from '../useNotes';
import { api } from '../../api/client';
import { asMock } from '../../test/mocks/api';

interface MockRoute extends Mock {
  get?: Mock;
  post?: Mock;
  delete?: Mock;
  log?: { post: Mock };
  ['auto-organize']?: { post: Mock };
}

// Mock API client
vi.mock('../../api/client', () => ({
  api: {
    api: {
      notes: {
        enabled: { get: vi.fn() },
        task: vi.fn(() => ({ get: vi.fn() })),
        create: { post: vi.fn() },
        search: { post: vi.fn() },
        link: { post: vi.fn() },
        unlink: vi.fn(() => ({ delete: vi.fn() }))
      }
    }
  }
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useNotes hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('useNotesEnabled should fetch status', async () => {
    asMock(api.api.notes.enabled.get).mockResolvedValue({
      data: { enabled: true },
      error: null
    });

    const { result } = renderHook(() => useNotesEnabled(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ enabled: true });
    expect(api.api.notes.enabled.get).toHaveBeenCalled();
  });

  it('useTaskNote should fetch note for a task', async () => {
    const mockNote = { id: 'note-1', title: 'Note 1', url: 'http://note' };
    asMock<MockRoute>(api.api.notes.task).mockReturnValue({
      get: vi.fn().mockResolvedValue({ data: { note: mockNote }, error: null })
    });

    const { result } = renderHook(() => useTaskNote('task-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockNote);
    expect(api.api.notes.task).toHaveBeenCalledWith({ taskId: 'task-1' });
  });

  it('useCreateNote should trigger mutation', async () => {
    asMock(api.api.notes.create.post).mockResolvedValue({
      data: { id: 'new-note' },
      error: null
    });

    const { result } = renderHook(() => useCreateNote(), { wrapper });

    result.current.mutate({ title: 'New Note', taskId: 'task-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.api.notes.create.post).toHaveBeenCalledWith({ title: 'New Note', taskId: 'task-1' });
  });

  it('useSearchNotes should return search results', async () => {
    const mockDocs = [{ id: '1', title: 'Doc 1', url: 'url1', updatedAt: '' }];
    asMock(api.api.notes.search.post).mockResolvedValue({
      data: { documents: mockDocs },
      error: null
    });

    const { result } = renderHook(() => useSearchNotes(), { wrapper });

    result.current.mutate({ query: 'test' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockDocs);
    expect(api.api.notes.search.post).toHaveBeenCalledWith({ query: 'test' });
  });

  it('useLinkNote should link a note to a task', async () => {
    asMock(api.api.notes.link.post).mockResolvedValue({
      data: { success: true },
      error: null
    });

    const { result } = renderHook(() => useLinkNote(), { wrapper });

    result.current.mutate({ taskId: 'task-1', noteId: 'note-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.api.notes.link.post).toHaveBeenCalledWith({ taskId: 'task-1', noteId: 'note-1' });
  });

  it('useUnlinkNote should unlink note from task', async () => {
    asMock<MockRoute>(api.api.notes.unlink).mockReturnValue({
      delete: vi.fn().mockResolvedValue({ data: { success: true }, error: null })
    });

    const { result } = renderHook(() => useUnlinkNote(), { wrapper });

    result.current.mutate('task-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.api.notes.unlink).toHaveBeenCalledWith({ taskId: 'task-1' });
  });
});
