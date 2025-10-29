export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  columnId: string;
  labels?: string[];
  columnName?: string;
  boardName?: string;
  boardId?: string;
  boardSpace?: 'work' | 'personal';
  metadata?: {
    link?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  type: 'task' | 'habit';
  space: 'work' | 'personal';
  completed: boolean;
  columnName?: string;
  boardName?: string;
  boardId?: string;
  instanceDate?: string;
  link?: string;
}

export interface CommandIntent {
  action: string;
  data: Record<string, unknown>;
  description: string;
}

export interface ApiError {
  error: string;
  message?: string;
}

export type Space = 'work' | 'personal';

export interface Board {
  id: string;
  name: string;
  description?: string;
  space: Space;
  columns: Column[];
}

export interface Column {
  id: string;
  name: string;
  boardId: string;
}
