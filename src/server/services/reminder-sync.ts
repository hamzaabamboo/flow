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

      // STEP 5: Calculate and create reminder
      const now = new Date();
      const reminderTime = new Date(dueDate);
      reminderTime.setMinutes(reminderTime.getMinutes() - minutesBefore);

      // If reminder time is in the past, but due date is in the future, create reminder for now + 1 minute
      let actualReminderTime = reminderTime;
      let actualMinutesBefore = minutesBefore;

      if (reminderTime <= now && dueDate > now) {
        // Task is due soon, but reminder would be in the past
        // Set reminder for 1 minute from now
        actualReminderTime = new Date(now.getTime() + 60 * 1000); // Now + 1 minute
        const timeUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (60 * 1000));
        actualMinutesBefore = timeUntilDue;

        logger.info(
          `Task ${taskId} due very soon (${timeUntilDue} min), setting reminder for 1 minute from now`
        );
      }

      // Only create if reminder time is in the future
      if (actualReminderTime > now) {
        await this.db.insert(reminders).values({
          userId,
          taskId,
          reminderTime: actualReminderTime,
          message: `Task due in ${actualMinutesBefore} minutes: ${taskTitle}`,
          sent: false,
          platform: null
        });

        logger.info(`Created reminder for task ${taskId} at ${actualReminderTime.toISOString()}`);
      } else {
        logger.info(`Reminder time is in the past for task ${taskId}, skipping`);
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
