export interface WSMessage {
  type: string;
  data?: unknown;
}

interface WSApp {
  server?: {
    publish: (channel: string, data: string) => void;
  } | null;
}

class WebSocketManager {
  private static instance: WebSocketManager;
  private app: WSApp | null = null;

  private constructor() {}

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  setApp(app: WSApp) {
    this.app = app;
  }

  // Broadcast to specific user
  broadcastToUser(userId: string, message: WSMessage) {
    if (this.app?.server?.publish) {
      this.app.server.publish(`user:${userId}`, JSON.stringify(message));
    }
  }

  // Broadcast to all users (system-wide messages)
  broadcastGlobal(message: WSMessage) {
    if (this.app?.server?.publish) {
      this.app.server.publish('global', JSON.stringify(message));
    }
  }

  // Legacy method - now broadcasts globally (for backward compat)
  broadcast(message: WSMessage) {
    this.broadcastGlobal(message);
  }

  // Broadcast task updates
  broadcastTaskUpdate(taskId: string, columnId: string, action: 'created' | 'updated' | 'deleted') {
    this.broadcast({
      type: 'task-update',
      data: {
        taskId,
        columnId,
        action
      }
    });
  }

  // Broadcast board updates
  broadcastBoardUpdate(boardId: string, action: 'created' | 'updated' | 'deleted') {
    this.broadcast({
      type: 'board-update',
      data: {
        boardId,
        action
      }
    });
  }

  // Broadcast column updates
  broadcastColumnUpdate(
    boardId: string,
    columnId: string,
    action: 'created' | 'updated' | 'deleted' | 'reordered'
  ) {
    this.broadcast({
      type: 'column-update',
      data: {
        boardId,
        columnId,
        action
      }
    });
  }

  // Broadcast inbox updates
  broadcastInboxUpdate(userId: string, space: string) {
    this.broadcast({
      type: 'inbox-update',
      data: {
        userId,
        space
      }
    });
  }

  // Send reminder notification
  sendReminder(userId: string, message: string, link?: string | null) {
    this.broadcast({
      type: 'reminder',
      data: {
        userId,
        message,
        link: link || undefined,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Broadcast Pomodoro events
  broadcastPomodoroEvent(userId: string, event: 'started' | 'completed' | 'paused') {
    this.broadcast({
      type: 'pomodoro-event',
      data: {
        userId,
        event,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Broadcast Pomodoro state updates
  broadcastPomodoroState(userId: string, event: 'started' | 'paused' | 'cleared', state: unknown) {
    this.broadcast({
      type: 'pomodoro-state',
      data: {
        userId,
        event,
        state,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Broadcast subtask updates
  broadcastSubtaskUpdate(
    taskId: string,
    subtaskId: string,
    action: 'created' | 'updated' | 'deleted' | 'reordered'
  ) {
    this.broadcast({
      type: 'subtask-update',
      data: {
        taskId,
        subtaskId,
        action
      }
    });
  }

  // Broadcast reminder updates
  broadcastReminderUpdate(taskId: string, action: 'created' | 'updated' | 'deleted' | 'triggered') {
    this.broadcast({
      type: 'reminder-update',
      data: {
        taskId,
        action
      }
    });
  }
}

export const wsManager = WebSocketManager.getInstance();
