import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAutoOrganize, useApplyAutoOrganize } from '../useAutoOrganize';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../../api/client';
import React from 'react';

// Mock API
vi.mock('../../../api/client', () => {
  const mockTasks: any = vi.fn();
  mockTasks['auto-organize'] = { post: vi.fn() };
  
  return {
    api: {
      api: {
        tasks: mockTasks
      }
    }
  };
});

const mockTaskPatch = vi.fn();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
});

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: queryClient }, children);

describe('useAutoOrganize hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    
    // Set up implementation for each test
    (api.api.tasks as any).mockImplementation(() => ({
        patch: mockTaskPatch
    }));
  });

  it('useAutoOrganize should call API and return data', async () => {
    (api.api.tasks['auto-organize'].post as vi.Mock).mockResolvedValue({ data: { suggestions: [] }, error: null });
    
    const { result } = renderHook(() => useAutoOrganize(), { wrapper });
    
    await result.current.mutateAsync({ space: 'work' } as any);
    
    expect(api.api.tasks['auto-organize'].post).toHaveBeenCalledWith({ space: 'work' });
  });

  it('useApplyAutoOrganize should apply suggestions', async () => {
    mockTaskPatch.mockResolvedValue({ data: {}, error: null });
    
    const { result } = renderHook(() => useApplyAutoOrganize(), { wrapper });
    
    const suggestions: any[] = [
        { taskId: 't1', details: { type: 'column_move', suggestedColumnId: 'c2' } },
        { taskId: 't2', details: { type: 'priority_change', suggestedPriority: 'high' } }
    ];
    
    const summary = await result.current.mutateAsync(suggestions);
    
    expect(summary.applied).toBe(2);
    expect(mockTaskPatch).toHaveBeenCalledTimes(2);
  });

  it('useApplyAutoOrganize should handle partial failures', async () => {
    mockTaskPatch
        .mockResolvedValueOnce({ data: {}, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Fail' } });
    
    const { result } = renderHook(() => useApplyAutoOrganize(), { wrapper });
    
    const suggestions: any[] = [
        { taskId: 't1', details: { type: 'column_move', suggestedColumnId: 'c2' } },
        { taskId: 't2', details: { type: 'priority_change', suggestedPriority: 'high' } }
    ];
    
    const summary = await result.current.mutateAsync(suggestions);
    
    expect(summary.applied).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.errors).toHaveLength(1);
  });
});