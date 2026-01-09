import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoOrganize, useApplyAutoOrganize } from '../useAutoOrganize';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { mockApi, getMockFn, getMockRoute } from '../../../test/mocks/api';
import type { AutoOrganizeSuggestion } from '../useAutoOrganize';

// Mock API using shared mocks
vi.mock('../../../api/client', async () => {
  const mocks = await import('../../../test/mocks/api');
  return {
    api: mocks.mockApi
  };
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
});

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: queryClient }, children);

describe('useAutoOrganize hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    // Set up implementation using type-safe helpers
    const tasksRoute = getMockRoute(mockApi.api.tasks);
    getMockFn(tasksRoute).mockReturnValue({
      patch: vi.fn().mockResolvedValue({ data: {}, error: null }),
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn()
    });
  });

  it('useAutoOrganize should call API and return data', async () => {
    const autoOrganizePost = getMockFn(mockApi.api.tasks['auto-organize'].post);
    autoOrganizePost.mockResolvedValue({ data: { suggestions: [] }, error: null });

    const { result } = renderHook(() => useAutoOrganize(), { wrapper });

    await result.current.mutateAsync({ space: 'work' });

    expect(autoOrganizePost).toHaveBeenCalledWith({ space: 'work' });
  });

  it('useApplyAutoOrganize should apply suggestions', async () => {
    const tasksRoute = getMockRoute(mockApi.api.tasks);
    const mockPatch = vi.fn().mockResolvedValue({ data: {}, error: null });
    getMockFn(tasksRoute).mockReturnValue({
      patch: mockPatch,
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn()
    });

    const { result } = renderHook(() => useApplyAutoOrganize(), { wrapper });

    const suggestions: AutoOrganizeSuggestion[] = [
      { taskId: 't1', details: { type: 'column_move', suggestedColumnId: 'c2' } },
      { taskId: 't2', details: { type: 'priority_change', suggestedPriority: 'high' } }
    ] as any;

    const summary = await result.current.mutateAsync(suggestions);

    expect(summary.applied).toBe(2);
    expect(mockPatch).toHaveBeenCalledTimes(2);
  });

  it('useApplyAutoOrganize should handle partial failures', async () => {
    const tasksRoute = getMockRoute(mockApi.api.tasks);
    const mockPatch = vi
      .fn()
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: null, error: { value: 'Fail' } });

    getMockFn(tasksRoute).mockReturnValue({
      patch: mockPatch,
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn()
    });

    const { result } = renderHook(() => useApplyAutoOrganize(), { wrapper });

    const suggestions: AutoOrganizeSuggestion[] = [
      { taskId: 't1', details: { type: 'column_move', suggestedColumnId: 'c2' } },
      { taskId: 't2', details: { type: 'priority_change', suggestedPriority: 'high' } }
    ] as any;

    const summary = await result.current.mutateAsync(suggestions);

    expect(summary.applied).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.errors).toHaveLength(1);
  });
});
