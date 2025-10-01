// Board, Column, and Task related types

import type { Subtask } from './task';

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  completed: boolean;
  columnId: string;
  space?: 'work' | 'personal';
  createdAt?: string;
  updatedAt?: string;
  labels?: string[];
  subtasks?: Subtask[];
  recurringPattern?: string;
  recurringEndDate?: string;
  parentTaskId?: string;
  createReminder?: boolean;
  column?: Column & { board?: Board };
}

export interface Column {
  id: string;
  name: string;
  boardId: string;
  taskOrder: string[];
  position?: number;
  wipLimit?: number | null;
  createdAt?: string;
}

export interface Board {
  id: string;
  name: string;
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
