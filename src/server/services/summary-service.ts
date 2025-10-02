import { eq, and, gte, lte, or } from 'drizzle-orm';
import {
  tasks,
  habits,
  habitLogs as habitLogsTable,
  columns,
  boards
} from '../../../drizzle/schema';
import type { Database } from '../db';
import { logger } from '../logger';

export class SummaryService {
  constructor(
    private db: Database,
    private instanceUrl: string = process.env.FRONTEND_URL || 'http://localhost:3000'
  ) {}

  /**
   * Generate morning summary for a user
   * Shows tasks due today, upcoming tasks (7 days), no habits
   */
  async generateMorningSummary(
    userId: string,
    spaces: ('work' | 'personal')[] = ['work', 'personal']
  ): Promise<string> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const sevenDaysLater = new Date(today);
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

      // Get tasks due today for all selected spaces
      const todayTasks = await this.db
        .select({
          id: tasks.id,
          title: tasks.title,
          priority: tasks.priority,
          dueDate: tasks.dueDate,
          boardName: boards.name,
          space: boards.space
        })
        .from(tasks)
        .leftJoin(columns, eq(tasks.columnId, columns.id))
        .leftJoin(boards, eq(columns.boardId, boards.id))
        .where(
          and(
            eq(tasks.userId, userId),
            spaces.length === 1
              ? eq(boards.space, spaces[0])
              : or(...spaces.map((s) => eq(boards.space, s))),
            eq(tasks.completed, false),
            gte(tasks.dueDate, today),
            lte(tasks.dueDate, tomorrow)
          )
        )
        .orderBy(tasks.priority, tasks.dueDate);

      // Get upcoming tasks (next 7 days)
      const upcomingTasks = await this.db
        .select({
          id: tasks.id,
          title: tasks.title,
          priority: tasks.priority,
          dueDate: tasks.dueDate,
          boardName: boards.name,
          space: boards.space
        })
        .from(tasks)
        .leftJoin(columns, eq(tasks.columnId, columns.id))
        .leftJoin(boards, eq(columns.boardId, boards.id))
        .where(
          and(
            eq(tasks.userId, userId),
            spaces.length === 1
              ? eq(boards.space, spaces[0])
              : or(...spaces.map((s) => eq(boards.space, s))),
            eq(tasks.completed, false),
            gte(tasks.dueDate, tomorrow),
            lte(tasks.dueDate, sevenDaysLater)
          )
        )
        .orderBy(tasks.dueDate, tasks.priority);

      // Format message
      const spaceLabel = spaces.length === 2 ? 'work & personal' : spaces[0];
      let message = `Good morning! 🌅\n\nHere's your ${spaceLabel} agenda for today:\n\n`;

      if (todayTasks.length > 0) {
        message += `📋 Tasks Due Today (${todayTasks.length}):\n`;
        todayTasks.forEach((task) => {
          const priorityEmoji = this.getPriorityEmoji(task.priority);
          const timeStr = task.dueDate
            ? new Date(task.dueDate).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Tokyo'
              })
            : '';
          const spaceEmoji = task.space === 'work' ? '💼' : '🏠';
          message += `  ${priorityEmoji} ${task.title}${timeStr ? ` - ${timeStr}` : ''} ${spaceEmoji}\n`;
        });
      } else {
        message += `📋 No tasks due today!\n`;
      }

      message += `\n`;

      if (upcomingTasks.length > 0) {
        message += `📅 Upcoming (Next 7 Days) (${upcomingTasks.length}):\n`;
        upcomingTasks.forEach((task) => {
          const priorityEmoji = this.getPriorityEmoji(task.priority);
          const dateStr = task.dueDate
            ? new Date(task.dueDate).toLocaleDateString('ja-JP', {
                month: 'short',
                day: 'numeric',
                timeZone: 'Asia/Tokyo'
              })
            : '';
          const spaceEmoji = task.space === 'work' ? '💼' : '🏠';
          message += `  ${priorityEmoji} ${task.title} - ${dateStr} ${spaceEmoji}\n`;
        });
        message += `\n`;
      }

      message += `\n\nHave a productive day! 💪`;
      message += `\n\n🔗 View HamFlow: ${this.instanceUrl}`;

      return message;
    } catch (error) {
      logger.error(error, `Failed to generate morning summary for user ${userId}`);
      throw error;
    }
  }

  /**
   * Generate evening summary for a user
   * Shows completed tasks, unfinished tasks, and incomplete habits
   */
  async generateEveningSummary(
    userId: string,
    spaces: ('work' | 'personal')[] = ['work', 'personal']
  ): Promise<string> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get completed tasks today
      const completedToday = await this.db
        .select({
          space: boards.space
        })
        .from(tasks)
        .leftJoin(columns, eq(tasks.columnId, columns.id))
        .leftJoin(boards, eq(columns.boardId, boards.id))
        .where(
          and(
            eq(tasks.userId, userId),
            spaces.length === 1
              ? eq(boards.space, spaces[0])
              : or(...spaces.map((s) => eq(boards.space, s))),
            eq(tasks.completed, true),
            gte(tasks.updatedAt, today),
            lte(tasks.updatedAt, tomorrow)
          )
        );

      // Get unfinished tasks that were due today or overdue
      const unfinishedTasks = await this.db
        .select({
          id: tasks.id,
          title: tasks.title,
          priority: tasks.priority,
          dueDate: tasks.dueDate,
          space: boards.space
        })
        .from(tasks)
        .leftJoin(columns, eq(tasks.columnId, columns.id))
        .leftJoin(boards, eq(columns.boardId, boards.id))
        .where(
          and(
            eq(tasks.userId, userId),
            spaces.length === 1
              ? eq(boards.space, spaces[0])
              : or(...spaces.map((s) => eq(boards.space, s))),
            eq(tasks.completed, false),
            lte(tasks.dueDate, tomorrow)
          )
        )
        .orderBy(tasks.dueDate);

      // Get today's habits for all spaces
      const todayDay = today.getDay();

      const activeHabits = await this.db
        .select({
          id: habits.id,
          name: habits.name,
          frequency: habits.frequency,
          targetDays: habits.targetDays,
          space: habits.space
        })
        .from(habits)
        .where(
          and(
            eq(habits.userId, userId),
            spaces.length === 1
              ? eq(habits.space, spaces[0])
              : or(...spaces.map((s) => eq(habits.space, s))),
            eq(habits.active, true)
          )
        );

      // Filter for today's habits
      const todayHabits = activeHabits.filter((habit) => {
        if (habit.frequency === 'daily') return true;
        if (habit.frequency === 'weekly' && habit.targetDays) {
          return habit.targetDays.includes(todayDay);
        }
        return false;
      });

      // Check which habits were completed
      const completedHabitLogs = await this.db
        .select()
        .from(habitLogsTable)
        .where(
          and(
            gte(habitLogsTable.date, today),
            lte(habitLogsTable.date, tomorrow),
            eq(habitLogsTable.completed, true)
          )
        );

      const completedHabitIds = new Set(completedHabitLogs.map((log) => log.habitId));
      const incompleteHabits = todayHabits.filter((h) => !completedHabitIds.has(h.id));

      // Format message
      const spaceLabel = spaces.length === 2 ? 'work & personal' : spaces[0];
      let message = `Good evening! 🌙\n\nHere's your ${spaceLabel} daily summary:\n\n`;

      message += `✅ Completed today: ${completedToday.length} tasks, ${completedHabitLogs.length} habits\n\n`;

      if (unfinishedTasks.length > 0) {
        message += `⏳ Unfinished Tasks (${unfinishedTasks.length}):\n`;
        unfinishedTasks.forEach((task) => {
          const priorityEmoji = this.getPriorityEmoji(task.priority);
          const overdueText =
            task.dueDate && new Date(task.dueDate) < new Date() ? ' (OVERDUE)' : '';
          const spaceEmoji = task.space === 'work' ? '💼' : '🏠';
          message += `  ${priorityEmoji} ${task.title}${overdueText} ${spaceEmoji}\n`;
        });
      } else {
        message += `✅ All tasks completed!\n`;
      }

      message += `\n`;

      if (incompleteHabits.length > 0) {
        message += `⏳ Incomplete Habits (${incompleteHabits.length}):\n`;
        incompleteHabits.forEach((habit) => {
          const spaceEmoji = habit.space === 'work' ? '💼' : '🏠';
          message += `  • ${habit.name} ${spaceEmoji}\n`;
        });
      } else {
        message += `✅ All habits completed!\n`;
      }

      message += `\n\nRest well! Tomorrow is a new day. 🌟`;
      message += `\n\n🔗 View HamFlow: ${this.instanceUrl}`;

      return message;
    } catch (error) {
      logger.error(error, `Failed to generate evening summary for user ${userId}`);
      throw error;
    }
  }

  private getPriorityEmoji(priority: string | null): string {
    switch (priority) {
      case 'urgent':
        return '🔴';
      case 'high':
        return '🟠';
      case 'medium':
        return '🟡';
      case 'low':
        return '🟢';
      default:
        return '⚪';
    }
  }
}
