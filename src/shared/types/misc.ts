// Miscellaneous types used across the application

export interface InboxItem {
  id: string;
  userId: string;
  title: string;
  content: string;
  description?: string;
  source: string;
  space: 'work' | 'personal';
  processed: boolean;
  processedAt?: string;
  createdAt: string;
}

export interface PomodoroSession {
  id?: string;
  userId?: string;
  type: 'work' | 'short-break' | 'long-break';
  duration: number;
  startTime?: string;
  endTime?: string;
  taskId?: string | null;
  taskTitle?: string | null;
}

export interface ActivePomodoroState {
  type: 'work' | 'short-break' | 'long-break';
  duration: number;
  timeLeft: number;
  isRunning: boolean;
  startTime?: string | null;
  completedSessions: number;
  taskId?: string | null;
  taskTitle?: string | null;
}

export interface Reminder {
  id: string;
  userId: string;
  taskId?: string;
  message: string;
  reminderTime: string;
  sent: boolean;
  space: 'work' | 'personal';
}
