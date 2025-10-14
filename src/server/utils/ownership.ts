/**
 * Authorization & Ownership Verification Helpers
 */

import type { DB } from '../db';
import { eq, and } from 'drizzle-orm';
import { boards, tasks, columns, habits, subtasks } from '../../../drizzle/schema';

/**
 * Verify user owns a board
 */
export async function verifyBoardOwnership(
  db: DB,
  boardId: string,
  userId: string
): Promise<boolean> {
  const [board] = await db
    .select({ id: boards.id })
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
    .limit(1);

  return !!board;
}

/**
 * Verify user owns a task
 */
export async function verifyTaskOwnership(
  db: DB,
  taskId: string,
  userId: string
): Promise<boolean> {
  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  return !!task;
}

/**
 * Verify user owns a column (via board ownership)
 */
export async function verifyColumnOwnership(
  db: DB,
  columnId: string,
  userId: string
): Promise<boolean> {
  const [column] = await db
    .select({ boardId: columns.boardId })
    .from(columns)
    .innerJoin(boards, eq(columns.boardId, boards.id))
    .where(and(eq(columns.id, columnId), eq(boards.userId, userId)))
    .limit(1);

  return !!column;
}

/**
 * Verify user owns a habit
 */
export async function verifyHabitOwnership(
  db: DB,
  habitId: string,
  userId: string
): Promise<boolean> {
  const [habit] = await db
    .select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .limit(1);

  return !!habit;
}

/**
 * Verify user owns a subtask (via task ownership)
 */
export async function verifySubtaskOwnership(
  db: DB,
  subtaskId: string,
  userId: string
): Promise<boolean> {
  const [subtask] = await db
    .select({ taskId: subtasks.taskId })
    .from(subtasks)
    .innerJoin(tasks, eq(subtasks.taskId, tasks.id))
    .where(and(eq(subtasks.id, subtaskId), eq(tasks.userId, userId)))
    .limit(1);

  return !!subtask;
}
