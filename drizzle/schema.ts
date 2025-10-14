import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  varchar,
  boolean,
  integer,
  pgEnum,
  date,
  type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const spaceEnum = pgEnum('space_enum', ['work', 'personal']);

// Users table (integrated with HamCloud auth)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  settings: jsonb('settings')
    .$type<{
      eveningSummaryEnabled?: boolean;
      morningSummaryEnabled?: boolean;
      summarySpaces?: ('work' | 'personal')[];
    }>()
    .default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Boards table
export const boards = pgTable('boards', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  space: spaceEnum('space').notNull(), // 'work' or 'personal'
  columnOrder: jsonb('column_order').notNull().default([]),
  settings: jsonb('settings')
    .$type<{
      reminderMinutesBefore?: number;
      enableAutoReminders?: boolean;
      dailySummaryEnabled?: boolean;
    }>()
    .default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Columns table
export const columns = pgTable('columns', {
  id: uuid('id').primaryKey().defaultRandom(),
  boardId: uuid('board_id')
    .references(() => boards.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  position: integer('position').notNull().default(0),
  wipLimit: integer('wip_limit'), // Work In Progress limit
  taskOrder: jsonb('task_order').notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Tasks table
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  columnId: uuid('column_id')
    .references(() => columns.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  dueDate: timestamp('due_date'),
  priority: varchar('priority', { length: 20 }), // 'low', 'medium', 'high', 'urgent'
  noteId: varchar('note_id', { length: 255 }), // Link to Notes Server
  labels: jsonb('labels').$type<string[]>().default([]), // Array of label strings
  recurringPattern: varchar('recurring_pattern', { length: 100 }), // 'daily', 'weekly', 'monthly', 'custom:cron'
  recurringEndDate: timestamp('recurring_end_date'), // When to stop recurring (optional)
  parentTaskId: uuid('parent_task_id').references((): AnyPgColumn => tasks.id, {
    onDelete: 'cascade'
  }),
  reminderMinutesBefore: integer('reminder_minutes_before'), // Task-level override (NULL = use board default)
  metadata: jsonb('metadata')
    .$type<{
      link?: string;
      attachments?: string[];
      estimatedTime?: number;
      actualTime?: number;
      tags?: string[];
      customFields?: Record<string, unknown>;
    }>()
    .default({}), // Flexible metadata for future extensions
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Subtasks table
export const subtasks = pgTable('subtasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id')
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  completed: boolean('completed').default(false),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Reminders table
export const reminders = pgTable('reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  reminderTime: timestamp('reminder_time').notNull(),
  message: text('message').notNull(),
  sent: boolean('sent').default(false),
  platform: varchar('platform', { length: 50 }), // 'discord', 'slack', 'telegram'
  link: text('link'), // Link to board (for tasks) or agenda (for habits)
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Inbox items table
export const inboxItems = pgTable('inbox_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  source: varchar('source', { length: 50 }), // 'command', 'hambot', 'email'
  space: spaceEnum('space').notNull(), // 'work' or 'personal'
  processed: boolean('processed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Habits table
export const habits = pgTable('habits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  frequency: varchar('frequency', { length: 50 }).notNull(), // 'daily', 'weekly'
  targetDays: integer('target_days').array(), // For weekly habits: [0,1,2,3,4] = weekdays
  reminderTime: varchar('reminder_time', { length: 5 }), // Optional time in HH:mm format (e.g., "07:00", "18:30")
  space: varchar('space', { length: 20 }).notNull(), // 'work' or 'personal'
  color: text('color'),
  active: boolean('active').default(true).notNull(),
  metadata: jsonb('metadata')
    .$type<{
      link?: string;
      customFields?: Record<string, unknown>;
    }>()
    .default({}), // Flexible metadata including links
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Habit logs table
export const habitLogs = pgTable('habit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  habitId: uuid('habit_id')
    .references(() => habits.id, { onDelete: 'cascade' })
    .notNull(),
  date: timestamp('date'),
  completedAt: timestamp('completed_at').notNull(),
  completed: boolean('completed').default(false),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Pomodoro sessions table
export const pomodoroSessions = pgTable('pomodoro_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  taskId: uuid('task_id').references(() => tasks.id),
  duration: integer('duration').notNull(), // in minutes
  type: varchar('type', { length: 50 }), // 'focus', 'break', 'long_break'
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Active Pomodoro timer state (one per user)
export const pomodoroActiveState = pgTable('pomodoro_active_state', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(), // 'work', 'short-break', 'long-break'
  duration: integer('duration').notNull(), // total duration in seconds
  timeLeft: integer('time_left').notNull(), // remaining time in seconds
  isRunning: boolean('is_running').notNull().default(false),
  startTime: timestamp('start_time'), // when timer was started (for drift correction)
  completedSessions: integer('completed_sessions').notNull().default(0),
  taskId: uuid('task_id').references(() => tasks.id),
  taskTitle: text('task_title'),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Calendar integrations table for OAuth tokens
export const calendarIntegrations = pgTable('calendar_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  provider: varchar('provider', { length: 50 }).notNull(), // 'google', 'microsoft'
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiry: timestamp('token_expiry'),
  email: varchar('email', { length: 255 }),
  calendarId: varchar('calendar_id', { length: 255 }),
  syncEnabled: boolean('sync_enabled').default(true).notNull(),
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Relations
export const tasksRelations = relations(tasks, ({ many, one }) => ({
  subtasks: many(subtasks),
  column: one(columns, {
    fields: [tasks.columnId],
    references: [columns.id]
  }),
  completions: many(taskCompletions)
}));

export const subtasksRelations = relations(subtasks, ({ one }) => ({
  task: one(tasks, {
    fields: [subtasks.taskId],
    references: [tasks.id]
  })
}));

export const columnsRelations = relations(columns, ({ one, many }) => ({
  board: one(boards, {
    fields: [columns.boardId],
    references: [boards.id]
  }),
  tasks: many(tasks)
}));

export const boardsRelations = relations(boards, ({ many }) => ({
  columns: many(columns)
}));

// Task completions table to track which dates a recurring task has been completed
export const taskCompletions = pgTable('task_completions', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  completedDate: date('completed_date').notNull(), // The specific date this instance was completed
  completedAt: timestamp('completed_at').defaultNow().notNull(), // When the user marked it complete
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
});

// Add relation to tasks
export const taskCompletionsRelations = relations(taskCompletions, ({ one }) => ({
  task: one(tasks, {
    fields: [taskCompletions.taskId],
    references: [tasks.id]
  }),
  user: one(users, {
    fields: [taskCompletions.userId],
    references: [users.id]
  })
}));
