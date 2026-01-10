// Board, Column, and Task related types

import type { Subtask } from './task';

export interface TaskMetadata {
  link?: string;
  attachments?: string[];
  estimatedTime?: number;
  actualTime?: number;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  columnId: string;
  columnName?: string | null;
  space?: 'work' | 'personal';
  completed?: boolean;
  createdAt?: string;
  updatedAt?: string;
  labels?: string[];
  subtasks?: Subtask[];
  recurringPattern?: string;
  recurringEndDate?: string;
  parentTaskId?: string;
  createReminder?: boolean;
  noteId?: string | null;
  metadata?: TaskMetadata;
  column?: Column & { board?: Board };
  // Convenience accessors for common metadata fields
  link?: string;
  // For recurring task instances (from expandRecurringTasks)
  instanceDate?: string;
}

export interface Column {
  id: string;
  name: string;
  boardId: string;
  taskOrder: string[];
  position?: number;
  wipLimit?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Board {
  id: string;
  name: string;
  description?: string;
  space: 'work' | 'personal';
  columnOrder: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BoardWithColumns extends Board {
  columns: Column[];
}

export interface BoardInfo {
  id: string;
  name: string;
  taskCount: number;
  overdueCount?: number;
  todayCount?: number;
  columnCount?: number;
  updatedAt?: string;
}

export interface ColumnData {
  id: string;
  name: string;
  taskOrder: string[];
  tasks: Task[];
}

export interface BoardData {
  id: string;
  name: string;
  space: string;
  columnOrder: string[];
  columns: ColumnData[];
}
