import type { Task } from '../types/board';

/**
 * Check if a column name represents a "Done" state
 */
export function isColumnDone(columnName: string): boolean {
  return columnName.toLowerCase() === 'done';
}

/**
 * Check if a task is completed based on its column name or completed flag (for recurring instances)
 */
export function isTaskCompleted(
  task: Task | { columnName?: string | null; completed?: boolean; instanceDate?: string }
): boolean {
  // First check column name - if in Done column, always consider completed
  if (task.columnName && isColumnDone(task.columnName)) {
    return true;
  }

  // For recurring task instances (not in Done column), check the completed flag for that specific instance
  if (
    'instanceDate' in task &&
    task.instanceDate &&
    'completed' in task &&
    task.completed !== undefined
  ) {
    return task.completed;
  }

  // Not in Done column and not a completed recurring instance
  return false;
}
