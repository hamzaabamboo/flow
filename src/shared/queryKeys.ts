/**
 * Centralized Query Key Factory
 *
 * Usage:
 * - queryKeys.boards.all() => ['boards']
 * - queryKeys.boards.detail(id) => ['boards', id]
 * - queryKeys.boards.lists() => ['boards', 'list']
 * - queryKeys.boards.list(filters) => ['boards', 'list', filters]
 */

export const queryKeys = {
  // Boards
  boards: {
    all: () => ['boards'] as const,
    lists: () => [...queryKeys.boards.all(), 'list'] as const,
    list: (filters?: { space?: string; search?: string }) =>
      [...queryKeys.boards.lists(), filters] as const,
    details: () => [...queryKeys.boards.all(), 'detail'] as const,
    detail: (boardId: string) => [...queryKeys.boards.details(), boardId] as const
  },

  // Tasks
  tasks: {
    all: () => ['tasks'] as const,
    lists: () => [...queryKeys.tasks.all(), 'list'] as const,
    list: (filters?: {
      space?: string;
      search?: string;
      priority?: string;
      label?: string;
      boardId?: string;
    }) => [...queryKeys.tasks.lists(), filters] as const,
    details: () => [...queryKeys.tasks.all(), 'detail'] as const,
    detail: (taskId: string) => [...queryKeys.tasks.details(), taskId] as const
  },

  // Columns
  columns: {
    all: () => ['columns'] as const,
    byBoard: (boardId: string) => [...queryKeys.columns.all(), 'board', boardId] as const
  },

  // Subtasks
  subtasks: {
    all: () => ['subtasks'] as const,
    byTask: (taskId: string) => [...queryKeys.subtasks.all(), 'task', taskId] as const
  },

  // Calendar
  calendar: {
    all: () => ['calendar'] as const,
    events: (params?: {
      start?: number;
      end?: number;
      space?: string;
      date?: Date;
      view?: string;
    }) => [...queryKeys.calendar.all(), 'events', params] as const
  },

  // Habits
  habits: {
    all: () => ['habits'] as const,
    lists: () => [...queryKeys.habits.all(), 'list'] as const,
    list: (filters?: { space?: string; date?: Date }) =>
      [...queryKeys.habits.lists(), filters] as const,
    details: () => [...queryKeys.habits.all(), 'detail'] as const,
    detail: (habitId: string) => [...queryKeys.habits.details(), habitId] as const
  },

  // Inbox
  inbox: {
    all: () => ['inbox'] as const,
    lists: () => [...queryKeys.inbox.all(), 'list'] as const,
    list: (space?: string) => [...queryKeys.inbox.lists(), space] as const
  },

  // Pomodoro
  pomodoro: {
    all: () => ['pomodoro'] as const,
    sessions: () => [...queryKeys.pomodoro.all(), 'sessions'] as const,
    active: () => [...queryKeys.pomodoro.all(), 'active'] as const
  },

  // Reminders
  reminders: {
    all: () => ['reminders'] as const,
    lists: () => [...queryKeys.reminders.all(), 'list'] as const,
    list: () => [...queryKeys.reminders.lists()] as const
  },

  // Settings
  settings: {
    all: () => ['settings'] as const,
    hambot: () => [...queryKeys.settings.all(), 'hambot'] as const
  },

  // Stats
  stats: {
    all: () => ['stats'] as const,
    summary: (space?: string) => [...queryKeys.stats.all(), 'summary', space] as const
  },

  // Search
  search: {
    all: () => ['search'] as const,
    query: (query: string, space?: string) => [...queryKeys.search.all(), query, space] as const
  }
} as const;
