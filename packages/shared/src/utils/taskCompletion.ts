/**
 * Helper utilities for determining task completion based on column name
 */

/**
 * Check if a column name represents a "Done" state
 */
export function isColumnDone(columnName: string): boolean {
  return columnName.toLowerCase() === 'done';
}

/**
 * Check if a task is completed based on its column name
 */
export function isTaskCompleted(columnName?: string | null): boolean {
  if (!columnName) return false;
  return isColumnDone(columnName);
}
