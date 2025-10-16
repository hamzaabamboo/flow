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
  task: Task | { columnName?: string | null; completed?: boolean; instanceDate?: string; recurringPattern?: string | null }
): boolean {
  // For recurring task instances, check the completed flag for that specific instance FIRST
  // This allows recurring tasks in Done column to still have incomplete future instances
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

  // For non-recurring tasks or recurring parent task (no instanceDate), check column name
  if (task.columnName && isColumnDone(task.columnName)) {
    return true;
  }

  // Not completed
  return false;
}
