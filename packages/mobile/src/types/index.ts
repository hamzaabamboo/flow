// Core types matching the server schema
export interface Task {
  id: string;
  columnId: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  labels?: string[];
  completed: boolean;
  recurring?: string;
  noteId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Board {
  id: string;
  name: string;
  description?: string;
  space: 'work' | 'personal';
  createdAt: string;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  order: number;
}

export interface Habit {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly';
  days?: number[];
  reminderTime?: string;
  space: 'work' | 'personal';
  createdAt: string;
  completedToday?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  instanceDate?: string;
  priority?: string;
  completed: boolean;
  type: 'task' | 'habit';
  space: 'work' | 'personal';
  link?: string;
  columnName?: string;
  boardId?: string;
  boardName?: string;
}

export type Space = 'work' | 'personal';
