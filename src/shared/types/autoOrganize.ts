/**
 * Auto Organize Feature Types
 * AI-powered task organization suggestions
 */

export type SuggestionType = 'column_move' | 'priority_change' | 'due_date_adjust';

export interface ColumnMoveSuggestion {
  type: 'column_move';
  currentBoardId: string;
  currentBoardName: string;
  currentColumnId: string;
  currentColumnName: string;
  suggestedBoardId: string;
  suggestedBoardName: string;
  suggestedColumnId: string;
  suggestedColumnName: string;
}

export interface PriorityChangeSuggestion {
  type: 'priority_change';
  currentPriority: 'low' | 'medium' | 'high' | 'urgent';
  suggestedPriority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface DueDateAdjustSuggestion {
  type: 'due_date_adjust';
  currentDueDate: string | null; // ISO string
  suggestedDueDate: string; // ISO string
}

export type SuggestionDetails =
  | ColumnMoveSuggestion
  | PriorityChangeSuggestion
  | DueDateAdjustSuggestion;

export interface AutoOrganizeSuggestion {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  details: SuggestionDetails;
  reason: string;
  confidence: number; // 0-100
  included: boolean; // For UI state: whether user wants to apply this suggestion
}

export interface AutoOrganizeRequest {
  space: 'work' | 'personal';
  boardId?: string; // Optional: filter to specific board
  startDate?: number; // Unix timestamp for Agenda view
  endDate?: number; // Unix timestamp for Agenda view
}

export interface AutoOrganizeResponse {
  suggestions: AutoOrganizeSuggestion[];
  summary: string;
  totalTasksAnalyzed: number;
  completedTasksSkipped: number;
}

export interface ApplySuggestionsRequest {
  suggestions: AutoOrganizeSuggestion[];
}

export interface ApplySuggestionsResponse {
  applied: number;
  failed: number;
  errors?: Array<{ taskId: string; error: string }>;
}
