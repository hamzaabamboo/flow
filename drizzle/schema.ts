import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  varchar,
  boolean,
  integer,
  pgEnum
} from 'drizzle-orm/pg-core';

export const spaceEnum = pgEnum('space_enum', ['work', 'personal']);

// Users table (integrated with HamCloud auth)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
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
  space: spaceEnum('space').notNull(), // 'work' or 'personal'
  columnOrder: jsonb('column_order').notNull().default([]),
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
  completed: boolean('completed').default(false),
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
  space: varchar('space', { length: 20 }).notNull(), // 'work' or 'personal'
  color: text('color'),
  active: boolean('active').default(true).notNull(),
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
