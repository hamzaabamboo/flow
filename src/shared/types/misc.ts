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
  taskId?: string;
  taskTitle?: string;
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
