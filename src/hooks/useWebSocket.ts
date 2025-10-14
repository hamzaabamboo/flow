import { useEffect, useRef, useCallback, useEffectEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Global toast callback - will be set by ToasterProvider
let globalToast:
  | ((message: string, options?: { type?: 'success' | 'error' | 'info' }) => void)
  | null = null;

export function setGlobalToast(
  toast: (message: string, options?: { type?: 'success' | 'error' | 'info' }) => void
) {
  globalToast = toast;
}

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const isIntentionallyClosed = useRef(false);

  const handleMessage = useEffectEvent((message: { type: string; data?: unknown }) => {
    // Handle different message types
    switch (message.type) {
      case 'task-update':
        queryClient.invalidateQueries({ queryKey: ['board'] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        break;
      case 'column-update': {
        // Invalidate board queries when columns change
        const data = message.data as { boardId?: string };
        if (data?.boardId) {
          queryClient.invalidateQueries({ queryKey: ['board', data.boardId] });
        }
        queryClient.invalidateQueries({ queryKey: ['board'] });
        break;
      }
      case 'board-update': {
        const data = message.data as { boardId?: string };
        queryClient.invalidateQueries({ queryKey: ['boards'] });
        if (data?.boardId) {
          queryClient.invalidateQueries({ queryKey: ['board', data.boardId] });
        }
        break;
      }
      case 'subtask-update': {
        // Invalidate task queries when subtasks change
        const data = message.data as { taskId?: string };
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['board'] });
        if (data?.taskId) {
          queryClient.invalidateQueries({ queryKey: ['subtasks', data.taskId] });
        }
        break;
      }
      case 'inbox-update': {
        // Invalidate inbox queries
        const data = message.data as { space?: string };
        queryClient.invalidateQueries({ queryKey: ['inbox'] });
        if (data?.space) {
          queryClient.invalidateQueries({ queryKey: ['inbox', data.space] });
        }
        break;
      }
      case 'pomodoro-event': {
        // Invalidate pomodoro queries
        queryClient.invalidateQueries({ queryKey: ['pomodoro'] });
        break;
      }
      case 'pomodoro-state': {
        // Invalidate active pomodoro state
        queryClient.invalidateQueries({ queryKey: ['pomodoro', 'active'] });
        break;
      }
      case 'reminder-update': {
        // Invalidate reminders
        queryClient.invalidateQueries({ queryKey: ['reminders'] });
        break;
      }
      case 'reminder': {
        // Show notification
        const data = message.data as { message?: string };

        // Always show toast notification in-app
        if (globalToast && data?.message) {
          globalToast(`⏰ ${data.message}`, { type: 'info' });
        }

        // Also try browser notification if permitted
        if ('Notification' in window && Notification.permission === 'granted' && data?.message) {
          const notification = new Notification('⏰ HamFlow Reminder', {
            body: data.message,
            icon: '/favicon.ico',
            tag: 'reminder',
            requireInteraction: true
          });
          // Reference notification to avoid unused variable warning
          void notification;
        }

        // Invalidate reminders list
        queryClient.invalidateQueries({ queryKey: ['reminders'] });
        break;
      }
      case 'server-shutdown':
        // Server is shutting down, prevent reconnection attempts
        console.log('Server is shutting down, stopping reconnection attempts');
        isIntentionallyClosed.current = true;
        reconnectAttempts.current = maxReconnectAttempts; // Prevent further reconnections
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = null;
        }
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  });

  const connect = useCallback(() => {
    // Don't reconnect if intentionally closed or too many attempts
    if (isIntentionallyClosed.current || reconnectAttempts.current >= maxReconnectAttempts) {
      return;
    }

    // Clean up existing connection if any
    if (ws.current) {
      // oxlint-disable-next-line unicorn/prefer-add-event-listener
      ws.current.onclose = null; // Prevent recursion
      if (
        ws.current.readyState === WebSocket.OPEN ||
        ws.current.readyState === WebSocket.CONNECTING
      ) {
        ws.current.close(1000, 'Reconnecting');
      }
      ws.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Get auth token from cookie
    const token = getCookie('auth');
    const wsUrl = `${protocol}//${window.location.host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    try {
      ws.current = new WebSocket(wsUrl);
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      return;
    }

    // oxlint-disable-next-line unicorn/prefer-add-event-listener
    ws.current.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts.current = 0; // Reset attempts on successful connection
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    // oxlint-disable-next-line unicorn/prefer-add-event-listener
    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    // oxlint-disable-next-line unicorn/prefer-add-event-listener
    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // oxlint-disable-next-line unicorn/prefer-add-event-listener
    ws.current.onclose = (event) => {
      // Don't reconnect if intentionally closed with code 1000
      if (event.code === 1000 && isIntentionallyClosed.current) {
        console.log('WebSocket closed intentionally');
        return;
      }

      reconnectAttempts.current++;
      const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // Max 30s

      console.log(
        `WebSocket disconnected (code: ${event.code}), reconnecting in ${backoffTime / 1000}s... (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`
      );

      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectTimeout.current = setTimeout(connect, backoffTime);
      } else {
        console.error('Max reconnection attempts reached. Please refresh the page.');
      }
    };
  }, [maxReconnectAttempts]);

  const sendMessage = useCallback((type: string, data: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, data }));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  useEffect(() => {
    isIntentionallyClosed.current = false;
    connect();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden && (!ws.current || ws.current.readyState !== WebSocket.OPEN)) {
        reconnectAttempts.current = 0; // Reset attempts when page becomes visible
        connect();
      }
    };

    // Handle window/tab close
    const handleBeforeUnload = () => {
      isIntentionallyClosed.current = true;

      // Clean up reconnect timeout
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }

      // Force close WebSocket connection immediately
      if (ws.current) {
        // oxlint-disable-next-line unicorn/prefer-add-event-listener
        ws.current.onclose = null; // Prevent reconnection
        // oxlint-disable-next-line unicorn/prefer-add-event-listener
        ws.current.onerror = null; // Prevent error handling
        // oxlint-disable-next-line unicorn/prefer-add-event-listener
        ws.current.onmessage = null; // Clear message handler
        // oxlint-disable-next-line unicorn/prefer-add-event-listener
        ws.current.onopen = null; // Clear open handler

        // Force close without waiting
        try {
          ws.current.close(1000, 'Window closing');
        } catch {
          // Ignore errors during close
        }
        ws.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleBeforeUnload);

    return () => {
      isIntentionallyClosed.current = true;

      // Clean up reconnect timeout
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }

      // Close WebSocket connection
      if (ws.current) {
        // oxlint-disable-next-line unicorn/prefer-add-event-listener
        ws.current.onclose = null; // Prevent reconnection
        // oxlint-disable-next-line unicorn/prefer-add-event-listener
        ws.current.onerror = null; // Prevent error handling
        // oxlint-disable-next-line unicorn/prefer-add-event-listener
        ws.current.onmessage = null; // Clear message handler
        // oxlint-disable-next-line unicorn/prefer-add-event-listener
        ws.current.onopen = null; // Clear open handler

        if (
          ws.current.readyState === WebSocket.OPEN ||
          ws.current.readyState === WebSocket.CONNECTING
        ) {
          ws.current.close(1000, 'Component unmounted');
        }
        ws.current = null;
      }

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
    };
  }, [connect]);

  return { sendMessage };
}
