import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const isIntentionallyClosed = useRef(false);

  const connect = useCallback(() => {
    // Don't reconnect if intentionally closed or too many attempts
    if (isIntentionallyClosed.current || reconnectAttempts.current >= maxReconnectAttempts) {
      return;
    }

    // Clean up existing connection if any
    if (ws.current) {
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
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      ws.current = new WebSocket(wsUrl);
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      return;
    }

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts.current = 0; // Reset attempts on successful connection
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

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
  }, []);

  const handleMessage = (message: { type: string; data?: unknown }) => {
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
      case 'reminder-update': {
        // Invalidate reminders
        queryClient.invalidateQueries({ queryKey: ['reminders'] });
        break;
      }
      case 'reminder': {
        // Show notification
        const data = message.data as { message?: string };
        if ('Notification' in window && Notification.permission === 'granted' && data?.message) {
          new Notification('HamFlow Reminder', {
            body: data.message,
            icon: '/favicon.ico'
          });
        }
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
  };

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
        ws.current.onclose = null; // Prevent reconnection
        ws.current.onerror = null; // Prevent error handling
        ws.current.onmessage = null; // Clear message handler
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
        ws.current.onclose = null; // Prevent reconnection
        ws.current.onerror = null; // Prevent error handling
        ws.current.onmessage = null; // Clear message handler
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
