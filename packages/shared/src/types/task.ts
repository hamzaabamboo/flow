// Task and Subtask related types

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  order: number;
}

// Simplified subtask format for UI state
export interface SimpleSubtask {
  id?: string;
  title: string;
  completed: boolean;
}
