import type { Subtask } from './task';

// Calendar and Task related types shared between frontend and backend

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  dueDate?: string | Date;
  priority?: string;
  completed?: boolean;
  type: 'task' | 'reminder' | 'habit';
  space?: string;
  recurringPattern?: string;
  recurringEndDate?: string;
  parentTaskId?: string;
  columnId?: string;
  boardId?: string;
  boardName?: string;
  columnName?: string;
  labels?: string[];
  subtasks?: Subtask[];
  instanceDate?: string; // For tracking specific instances of recurring tasks
  link?: string;
}

export interface ExtendedTask {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  completed: boolean;
  columnId: string;
  columnName: string;
  boardName: string;
  boardId: string;
  boardSpace: string;
  createdAt: string;
  updatedAt: string;
  labels?: string[];
  subtasks?: Subtask[];
  recurringPattern?: string;
  recurringEndDate?: string;
  type?: 'task' | 'reminder' | 'habit';
  space?: string;
  parentTaskId?: string;
  instanceDate?: string;
  link?: string;
}

export interface Habit {
  id: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'custom';
  targetDays?: number[];
  active: boolean;
  color?: string;
  reminderTime?: string;
  completedToday?: boolean;
  currentStreak?: number;
  space?: 'work' | 'personal';
  link?: string;
}

export interface CalendarFeedResponse {
  feedUrl: string;
}

export interface CalendarEventsQuery {
  start: string;
  end: string;
  space?: string;
}
