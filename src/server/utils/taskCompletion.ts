const DONE_COLUMN_NAMES = new Set(['done', 'completed']);
const IN_PROGRESS_COLUMN_NAMES = new Set(['in progress', 'in-progress', 'doing']);
const TODO_COLUMN_NAMES = new Set(['to do', 'todo', 'backlog']);

function normalizeColumnName(columnName: string) {
  return columnName.trim().toLowerCase();
}

export function isColumnDone(columnName: string): boolean {
  return DONE_COLUMN_NAMES.has(normalizeColumnName(columnName));
}

export function isTaskCompleted(columnName?: string | null): boolean {
  if (!columnName) return false;
  return isColumnDone(columnName);
}

export function getTaskCompletionState(task: {
  completed?: boolean | null;
  columnName?: string | null;
}) {
  if (typeof task.completed === 'boolean') {
    return task.completed;
  }

  if (task.columnName) {
    return isColumnDone(task.columnName);
  }

  return false;
}

export interface CompletionColumn {
  id: string;
  name: string;
}

function findByNames(columns: CompletionColumn[], names: Set<string>) {
  return columns.find((column) => names.has(normalizeColumnName(column.name)));
}

export function resolveCompletionColumnId(
  columns: CompletionColumn[],
  completed: boolean,
  currentColumnId: string
) {
  if (completed) {
    const doneColumn = findByNames(columns, DONE_COLUMN_NAMES);
    return doneColumn?.id ?? currentColumnId;
  }

  const inProgressColumn = findByNames(columns, IN_PROGRESS_COLUMN_NAMES);
  if (inProgressColumn && !isColumnDone(inProgressColumn.name)) {
    return inProgressColumn.id;
  }

  const todoColumn = findByNames(columns, TODO_COLUMN_NAMES);
  if (todoColumn && !isColumnDone(todoColumn.name)) {
    return todoColumn.id;
  }

  const firstActiveColumn = columns.find((column) => !isColumnDone(column.name));
  return firstActiveColumn?.id ?? currentColumnId;
}
