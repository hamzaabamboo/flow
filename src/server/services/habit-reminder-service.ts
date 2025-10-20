import { eq, and, sql } from 'drizzle-orm';
import { habits, reminders } from '../../../drizzle/schema';
import type { Database } from '../db';
import { logger } from '../logger';
import { nowInJst, getJstDateComponents, createJstDate } from '../../shared/utils/timezone';

export class HabitReminderService {
  constructor(private db: Database) {}

  /**
   * Create reminders for all active habits that should run today
   */
  async createDailyReminders(): Promise<number> {
    try {
      logger.info('Creating daily habit reminders...');

      // Get all active habits with reminder times
      const activeHabits = await this.db.select().from(habits).where(eq(habits.active, true));

      const habitsWithReminders = activeHabits.filter(
        (habit) => habit.reminderTime !== null && habit.reminderTime !== ''
      );

      logger.info(`Found ${habitsWithReminders.length} habits with reminders`);

      // Get current date/time in JST
      const nowUtc = new Date();
      const jstNow = nowInJst();
      const { year, month, day, dayOfWeek } = getJstDateComponents(jstNow);

      // Process habits in parallel to avoid await in loop
      const reminderPromises = habitsWithReminders.map(async (habit) => {
        try {
          // Check if habit should run today
          const shouldRunToday = this.shouldHabitRunToday(habit, dayOfWeek);
          if (!shouldRunToday) {
            return { success: false, reason: 'not-scheduled-today' };
          }

          // Parse reminder time (stored as JST, e.g., "09:00")
          const [hours, minutes] = habit.reminderTime!.split(':').map(Number);

          // Create UTC date for reminder time
          const reminderTimeUtc = createJstDate(year, month, day, hours, minutes);

          // Only create if reminder is in the future
          if (reminderTimeUtc <= nowUtc) {
            logger.info(`Reminder time already passed for habit ${habit.id}, skipping`);
            return { success: false, reason: 'time-passed' };
          }

          // Check if reminder already exists
          if (await this.reminderExists(habit.userId, habit.name, reminderTimeUtc)) {
            logger.info(`Reminder already exists for habit ${habit.id}`);
            return { success: false, reason: 'already-exists' };
          }

          // Create reminder with link if exists
          const metadata = habit.metadata as { link?: string } | null;
          const link = metadata?.link;

          let message = `Habit reminder: ${habit.name}`;
          if (link) {
            message += `\n${link}`;
          }

          await this.db.insert(reminders).values({
            userId: habit.userId,
            taskId: null,
            reminderTime: reminderTimeUtc,
            message,
            sent: false,
            platform: null
          });

          logger.info(
            `Created reminder for habit ${habit.id} (${habit.name}) at ${reminderTimeUtc.toISOString()}`
          );
          return { success: true };
        } catch (error) {
          logger.error(error, `Failed to create reminder for habit ${habit.id}`);
          return { success: false, reason: 'error' };
        }
      });

      const results = await Promise.allSettled(reminderPromises);
      const created = results.filter(
        (result) => result.status === 'fulfilled' && result.value.success
      ).length;

      logger.info(`Created ${created} habit reminders`);
      return created;
    } catch (error) {
      logger.error(error, 'Failed to create daily habit reminders');
      throw error;
    }
  }

  /**
   * Check if a habit should run today based on frequency and target days
   */
  private shouldHabitRunToday(
    habit: { frequency: string; targetDays: number[] | null },
    dayOfWeek: number
  ): boolean {
    if (habit.frequency === 'daily') {
      return true;
    }

    if (habit.frequency === 'weekly' && habit.targetDays) {
      return habit.targetDays.includes(dayOfWeek);
    }

    return false;
  }

  /**
   * Check if a reminder already exists for this habit today
   */
  private async reminderExists(
    userId: string,
    habitName: string,
    reminderTime: Date
  ): Promise<boolean> {
    // Get the date string for comparison (YYYY-MM-DD)
    const targetDateStr = reminderTime.toISOString().split('T')[0];

    // Find ANY reminder (sent or unsent) for this habit on this date
    // Use LIKE to handle messages with or without links appended
    const [existing] = await this.db
      .select()
      .from(reminders)
      .where(
        and(
          eq(reminders.userId, userId),
          // Match messages starting with "Habit reminder: {habitName}"
          sql`${reminders.message} LIKE ${'Habit reminder: ' + habitName + '%'}`
        )
      )
      .limit(1);

    // Check if the existing reminder is for the same date
    if (existing) {
      const existingDateStr = existing.reminderTime.toISOString().split('T')[0];
      if (existingDateStr === targetDateStr) {
        logger.info(`Reminder already exists for habit "${habitName}" on ${targetDateStr}`);
        return true;
      }
    }

    return false;
  }
}
