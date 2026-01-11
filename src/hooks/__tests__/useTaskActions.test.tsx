import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTaskActions } from '../useTaskActions';
import { SpaceContext, SpaceContextType } from '../../contexts/SpaceContext';
import { api } from '../../api/client';
import { navigate } from 'vike/client/router';
import type { Task } from '../../shared/types';
import { asMock } from '../../test/mocks/api';

interface MockTasks extends Mock {
  post?: Mock;
}

// Mock dependencies
vi.mock('../../api/client', () => ({
  api: {
    api: {
      tasks: vi.fn(() => ({
        delete: vi.fn(),
        get: vi.fn(),
        patch: vi.fn()
      }))
    }
  }
}));

// Mock vike/client/router
vi.mock('vike/client/router', () => ({
  navigate: vi.fn()
}));

// Mock custom hook useDialogs
const mockConfirm = vi.fn();
vi.mock('../../utils/useDialogs', () => ({
  useDialogs: () => ({
    confirm: mockConfirm
  })
}));

const mockSpaceContext: SpaceContextType = {
  currentSpace: 'work',
  setCurrentSpace: vi.fn(),
  toggleSpace: vi.fn()
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <SpaceContext.Provider value={mockSpaceContext}>{children}</SpaceContext.Provider>
  </QueryClientProvider>
);

describe('useTaskActions', () => {
  const mockTask = { id: 'task-1', title: 'Test Task', boardId: 'board-1' };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    // Setup nested mocks for api.api.tasks
    asMock<MockTasks>(api.api.tasks).mockReturnValue({
      delete: vi.fn().mockResolvedValue({ data: {}, error: null }),
      get: vi.fn().mockResolvedValue({ data: mockTask, error: null }),
      patch: vi.fn().mockResolvedValue({ data: {}, error: null })
    });
    // For tasks.post
    asMock<MockTasks>(api.api.tasks).post = vi.fn().mockResolvedValue({ data: {}, error: null });
  });

  it('handleEdit should call onTaskEdit', () => {
    const onTaskEdit = vi.fn();
    const { result } = renderHook(() => useTaskActions({ onTaskEdit }), { wrapper });

    act(() => {
      result.current.handleEdit(mockTask as unknown as Task);
    });

    expect(onTaskEdit).toHaveBeenCalledWith(mockTask);
  });

  it('handleDelete should trigger mutation when confirmed', async () => {
    mockConfirm.mockResolvedValue(true);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useTaskActions({ onSuccess }), { wrapper });

    act(() => {
      result.current.handleDelete(mockTask as unknown as Task);
    });

    expect(mockConfirm).toHaveBeenCalled();

    await waitFor(() => {
      expect(api.api.tasks).toHaveBeenCalledWith({ id: 'task-1' });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('handleDelete should not trigger mutation when cancelled', async () => {
    mockConfirm.mockResolvedValue(false);
    const { result } = renderHook(() => useTaskActions(), { wrapper });

    act(() => {
      result.current.handleDelete(mockTask as unknown as Task);
    });

    expect(mockConfirm).toHaveBeenCalled();

    await waitFor(() => {
      expect(api.api.tasks).not.toHaveBeenCalled();
    });
  });

  it('handleDuplicate should fetch full task and create a copy', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useTaskActions({ onSuccess }), { wrapper });

    act(() => {
      result.current.handleDuplicate(mockTask as unknown as Task);
    });

    await waitFor(() => {
      expect(api.api.tasks).toHaveBeenCalledWith({ id: 'task-1' });
      expect(asMock<MockTasks>(api.api.tasks).post).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Task (Copy)',
          completed: false
        })
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('handleMove should set move dialog state', () => {
    const { result } = renderHook(() => useTaskActions(), { wrapper });

    act(() => {
      result.current.handleMove(mockTask as unknown as Task);
    });

    expect(result.current.isMoveDialogOpen).toBe(true);
    expect(result.current.taskToMove).toEqual(mockTask);
  });

  it('handleViewBoard should navigate to board URL', () => {
    const { result } = renderHook(() => useTaskActions(), { wrapper });

    act(() => {
      result.current.handleViewBoard(mockTask as unknown as Task);
    });

    expect(navigate).toHaveBeenCalledWith('/board/board-1');
  });
});
