const DONE_COLUMN_NAMES = new Set(['done', 'completed']);

export function isColumnDone(columnName: string): boolean {
  return DONE_COLUMN_NAMES.has(columnName.trim().toLowerCase());
}

export function isTaskCompleted(columnName?: string | null): boolean {
  if (!columnName) return false;
  return isColumnDone(columnName);
}
