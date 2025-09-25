import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useWebSocket } from '../useWebSocket';

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;

    // Simulate connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(_data: string) {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }
}

global.WebSocket = MockWebSocket as unknown as typeof WebSocket;

describe('useWebSocket', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('should establish WebSocket connection on mount', async () => {
    const { result } = renderHook(() => useWebSocket(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(result.current.sendMessage).toBeDefined();
  });

  it('should handle incoming messages', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useWebSocket(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const ws = (
      global as unknown as { WebSocket: { mock: { results: Array<{ value: MockWebSocket }> } } }
    ).WebSocket.mock.results[0].value;

    act(() => {
      if (ws.onmessage) {
        ws.onmessage(
          new MessageEvent('message', {
            data: JSON.stringify({ type: 'task-update', data: { taskId: 'task-1' } })
          })
        );
      }
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['board'] });
  });

  it('should handle board update messages', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useWebSocket(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const ws = (
      global as unknown as { WebSocket: { mock: { results: Array<{ value: MockWebSocket }> } } }
    ).WebSocket.mock.results[0].value;

    act(() => {
      if (ws.onmessage) {
        ws.onmessage(
          new MessageEvent('message', {
            data: JSON.stringify({ type: 'board-update', data: { boardId: 'board-1' } })
          })
        );
      }
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['boards'] });
  });

  it('should handle reminder messages', async () => {
    const mockNotification = vi.fn() as unknown as typeof Notification & { permission: string };
    mockNotification.permission = 'granted';
    (global as unknown as { Notification: typeof mockNotification }).Notification =
      mockNotification;

    renderHook(() => useWebSocket(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const ws = (
      global as unknown as { WebSocket: { mock: { results: Array<{ value: MockWebSocket }> } } }
    ).WebSocket.mock.results[0].value;

    act(() => {
      if (ws.onmessage) {
        ws.onmessage(
          new MessageEvent('message', {
            data: JSON.stringify({ type: 'reminder', data: { message: 'Test reminder' } })
          })
        );
      }
    });

    expect(mockNotification).toHaveBeenCalledWith(
      'HamFlow Reminder',
      expect.objectContaining({ body: 'Test reminder' })
    );
  });

  it('should send messages when connected', async () => {
    const { result } = renderHook(() => useWebSocket(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const ws = (
      global as unknown as { WebSocket: { mock: { results: Array<{ value: MockWebSocket }> } } }
    ).WebSocket.mock.results[0].value;
    const sendSpy = vi.spyOn(ws, 'send');

    act(() => {
      result.current.sendMessage('test-type', { data: 'test' });
    });

    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({ type: 'test-type', data: { data: 'test' } })
    );
  });

  it('should handle reconnection on close', async () => {
    const { unmount } = renderHook(() => useWebSocket(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const ws = (
      global as unknown as { WebSocket: { mock: { results: Array<{ value: MockWebSocket }> } } }
    ).WebSocket.mock.results[0].value;

    act(() => {
      if (ws.onclose) ws.onclose();
    });

    // Should attempt to reconnect
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3100));
    });

    unmount();
  });

  it('should handle malformed messages gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderHook(() => useWebSocket(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const ws = (
      global as unknown as { WebSocket: { mock: { results: Array<{ value: MockWebSocket }> } } }
    ).WebSocket.mock.results[0].value;

    act(() => {
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', { data: 'invalid json' }));
      }
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to parse WebSocket message:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should cleanup on unmount', async () => {
    const { unmount } = renderHook(() => useWebSocket(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const ws = (
      global as unknown as { WebSocket: { mock: { results: Array<{ value: MockWebSocket }> } } }
    ).WebSocket.mock.results[0].value;
    const closeSpy = vi.spyOn(ws, 'close');

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });
});
