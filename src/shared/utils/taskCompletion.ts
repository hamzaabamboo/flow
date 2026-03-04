import type { Task } from '../types/board';

const DONE_COLUMN_NAMES = new Set(['done', 'completed']);

export function isColumnDone(columnName: string): boolean {
  return DONE_COLUMN_NAMES.has(columnName.trim().toLowerCase());
}

export function isTaskCompleted(
  task:
    | Task
    | {
        columnName?: string | null;
        completed?: boolean;
        instanceDate?: string;
        recurringPattern?: string | null;
      }
): boolean {
  if (
    'instanceDate' in task &&
    task.instanceDate &&
    'completed' in task &&
    task.completed !== undefined &&
    'recurringPattern' in task &&
    task.recurringPattern
  ) {
    return task.completed;
  }

  if (task.columnName && isColumnDone(task.columnName)) {
    return true;
  }

  return false;
}
