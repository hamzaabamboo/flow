import { eq, and } from 'drizzle-orm';
import { reminders, columns } from '../../../drizzle/schema';
import type { Database } from '../db';
import { DEFAULT_REMINDER_MINUTES_BEFORE } from '../../shared/constants';
import { logger } from '../logger';
import { isColumnDone } from '../utils/taskCompletion';

interface ReminderSyncOptions {
  userId: string;
  taskId: string;
  taskTitle: string;
  columnId: string;
  dueDate: Date | null;
  reminderOverride?: number | null;
}

export class ReminderSyncService {
  constructor(private db: Database) {}

  /**
   * Sync reminders for a task
   * Call this after any task create/update operation
   */
  async syncReminders(options: ReminderSyncOptions): Promise<void> {
    const { taskId, userId, dueDate, reminderOverride, columnId, taskTitle } = options;

    try {
      // STEP 1: Delete existing unsent reminders for this task
      await this.db
        .delete(reminders)
        .where(and(eq(reminders.taskId, taskId), eq(reminders.sent, false)));

      // STEP 2: Get column to check if task is completed
      const column = await this.db.query.columns.findFirst({
        where: eq(columns.id, columnId),
        with: {
          board: true
        }
      });

      const completed = column?.name ? isColumnDone(column.name) : false;

      // STEP 3: Determine if we need to create a new reminder
      const shouldCreateReminder =
        !completed && // Not completed
        dueDate !== null && // Has a due date
        dueDate > new Date(); // Due date is in the future

      if (!shouldCreateReminder) {
        logger.info(`No reminder needed for task ${taskId}`);
        return;
      }

      // STEP 4: Get board settings (hierarchical)
      if (!column?.board) {
        logger.warn(`Board not found for column ${columnId}, using defaults`);
      }

      const boardSettings = column?.board?.settings as
        | {
            reminderMinutesBefore?: number;
            enableAutoReminders?: boolean;
          }
        | undefined;

      const minutesBefore =
        reminderOverride ?? boardSettings?.reminderMinutesBefore ?? DEFAULT_REMINDER_MINUTES_BEFORE;

      const autoRemindersEnabled = boardSettings?.enableAutoReminders ?? true;

      if (!autoRemindersEnabled && !reminderOverride) {
        logger.info(`Auto-reminders disabled for board, task ${taskId}`);
        return;
      }

      // STEP 5: Calculate and create TWO reminders (15 min before + at due time)
      const now = new Date();
      const remindersToCreate = [];

      // First reminder: 15 minutes before (always)
      const firstReminderTime = new Date(dueDate);
      firstReminderTime.setMinutes(firstReminderTime.getMinutes() - 15);

      if (firstReminderTime > now) {
        remindersToCreate.push({
          userId,
          taskId,
          reminderTime: firstReminderTime,
          message: `Task due in 15 minutes: ${taskTitle}`,
          sent: false,
          platform: null
        });
      }

      // Second reminder: At due time (or use custom minutesBefore if specified)
      const secondReminderTime = new Date(dueDate);
      if (minutesBefore !== 15) {
        // If user specified custom time, use it for second reminder
        secondReminderTime.setMinutes(secondReminderTime.getMinutes() - minutesBefore);
      }
      // Otherwise, second reminder is at due time (no subtraction)

      if (secondReminderTime > now) {
        const minutesUntilDue = Math.max(
          0,
          Math.floor((dueDate.getTime() - secondReminderTime.getTime()) / (60 * 1000))
        );
        const message =
          minutesUntilDue === 0
            ? `Task is due now: ${taskTitle}`
            : `Task due in ${minutesUntilDue} minutes: ${taskTitle}`;

        remindersToCreate.push({
          userId,
          taskId,
          reminderTime: secondReminderTime,
          message,
          sent: false,
          platform: null
        });
      }

      // If both reminders are in the past but due date is in future, create one for now + 1 minute
      if (remindersToCreate.length === 0 && dueDate > now) {
        const immediateReminderTime = new Date(now.getTime() + 60 * 1000);
        const timeUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (60 * 1000));

        remindersToCreate.push({
          userId,
          taskId,
          reminderTime: immediateReminderTime,
          message: `Task due in ${timeUntilDue} minutes: ${taskTitle}`,
          sent: false,
          platform: null
        });

        logger.info(
          `Task ${taskId} due very soon (${timeUntilDue} min), setting reminder for 1 minute from now`
        );
      }

      // Create all reminders
      if (remindersToCreate.length > 0) {
        await this.db.insert(reminders).values(remindersToCreate);
        logger.info(
          `Created ${remindersToCreate.length} reminder(s) for task ${taskId} at ${remindersToCreate.map((r) => r.reminderTime.toISOString()).join(', ')}`
        );
      } else {
        logger.info(`No reminders needed for task ${taskId} (all would be in the past)`);
      }
    } catch (error) {
      logger.error(error, `Failed to sync reminders for task ${taskId}`);
      throw error;
    }
  }

  /**
   * Get reminder settings for a task (hierarchical lookup)
   */
  async getReminderSettings(columnId: string): Promise<{
    reminderMinutesBefore: number;
    enableAutoReminders: boolean;
  }> {
    const column = await this.db.query.columns.findFirst({
      where: eq(columns.id, columnId),
      with: {
        board: true
      }
    });

    const boardSettings = column?.board?.settings as
      | {
          reminderMinutesBefore?: number;
          enableAutoReminders?: boolean;
        }
      | undefined;

    return {
      reminderMinutesBefore:
        boardSettings?.reminderMinutesBefore ?? DEFAULT_REMINDER_MINUTES_BEFORE,
      enableAutoReminders: boardSettings?.enableAutoReminders ?? true
    };
  }
}
