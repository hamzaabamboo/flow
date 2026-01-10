import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useWebSocket } from '../useWebSocket';

// Mock WebSocket constants
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSING = 2;
const WS_CLOSED = 3;

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  static CONNECTING = WS_CONNECTING;
  static OPEN = WS_OPEN;
  static CLOSING = WS_CLOSING;
  static CLOSED = WS_CLOSED;

  constructor(url: string) {
    this.url = url;
    this.readyState = WS_CONNECTING;

    // Simulate connection
    setTimeout(() => {
      this.readyState = WS_OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(_data: string) {
    if (this.readyState !== WS_OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close(code?: number) {
    this.readyState = WS_CLOSED;
    if (this.onclose) this.onclose({ code: code || 1000 });
  }
}

// Track WebSocket instances
const wsInstances: MockWebSocket[] = [];

// @ts-expect-error Mocking global WebSocket
global.WebSocket = class extends MockWebSocket {
  constructor(url: string) {
    super(url);
    wsInstances.push(this);
  }
};
// Ensure constants are on the class
Object.assign(global.WebSocket, {
  CONNECTING: WS_CONNECTING,
  OPEN: WS_OPEN,
  CLOSING: WS_CLOSING,
  CLOSED: WS_CLOSED
});

describe('useWebSocket', () => {
  let queryClient: QueryClient;
  const originalLocation = global.window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    wsInstances.length = 0; // Clear instances
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });

    // Mock location

    delete (global as any).window.location;
    (global as any).window.location = {
      ...originalLocation,
      protocol: 'http:',
      host: 'localhost:3000'
    } as any;
  });

  afterEach(() => {
    (global as any).window.location = originalLocation;
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('should establish WebSocket connection on mount', async () => {
    const { result } = renderHook(() => useWebSocket(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(result.current.sendMessage).toBeDefined();
    expect(wsInstances.length).toBe(1);
  });

  it('should handle task-update messages', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useWebSocket(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const ws = wsInstances[0];

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

  it('should handle board-update messages', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useWebSocket(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const ws = wsInstances[0];

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

  it('should handle column-update messages', async () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useWebSocket(), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    const ws = wsInstances[0];

    act(() => {
      ws.onmessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({ type: 'column-update', data: { boardId: 'b1' } })
        })
      );
    });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['board', 'b1'] }));
  });

  it('should handle subtask-update messages', async () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useWebSocket(), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    const ws = wsInstances[0];

    act(() => {
      ws.onmessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({ type: 'subtask-update', data: { taskId: 't1' } })
        })
      );
    });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['subtasks', 't1'] }));
  });

  it('should handle inbox-update messages', async () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useWebSocket(), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    const ws = wsInstances[0];

    act(() => {
      ws.onmessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({ type: 'inbox-update', data: { space: 'work' } })
        })
      );
    });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['inbox', 'work'] }));
  });

  it('should handle reminder messages', async () => {
    const mockNotification = vi.fn() as unknown as typeof Notification & { permission: string };
    mockNotification.permission = 'granted';

    global.Notification = mockNotification;

    renderHook(() => useWebSocket(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const ws = wsInstances[0];

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
      '⏰ HamFlow Reminder',
      expect.objectContaining({ body: 'Test reminder' })
    );
  });

  it('should handle pomodoro events', async () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useWebSocket(), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    const ws = wsInstances[0];

    act(() => {
      ws.onmessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({ type: 'pomodoro-event' })
        })
      );
    });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['pomodoro'] }));
  });

  it('should send messages when connected', async () => {
    const { result } = renderHook(() => useWebSocket(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const ws = wsInstances[0];
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

    const ws = wsInstances[0];

    act(() => {
      if (ws.onclose) ws.onclose({ code: 1006 });
    });

    // Should attempt to reconnect
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3100));
    });

    expect(wsInstances.length).toBeGreaterThan(1);
    unmount();
  });

  it('should handle server-shutdown', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    renderHook(() => useWebSocket(), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    const ws = wsInstances[0];

    act(() => {
      ws.onmessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({ type: 'server-shutdown' })
        })
      );
    });
    expect(logSpy).toHaveBeenCalledWith('Server is shutting down, stopping reconnection attempts');
    logSpy.mockRestore();
  });

  it('should handle malformed messages gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderHook(() => useWebSocket(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const ws = wsInstances[0];

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

    const ws = wsInstances[0];
    const closeSpy = vi.spyOn(ws, 'close');

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });
});
