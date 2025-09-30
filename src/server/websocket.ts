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

  broadcast(message: WSMessage) {
    if (this.app?.server?.publish) {
      this.app.server.publish('hamflow', JSON.stringify(message));
    }
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
  sendReminder(userId: string, message: string) {
    this.broadcast({
      type: 'reminder',
      data: {
        userId,
        message,
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
