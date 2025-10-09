import { eq, and, lte } from 'drizzle-orm';
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
      const activeHabits = await this.db
        .select()
        .from(habits)
        .where(eq(habits.active, true));

      const habitsWithReminders = activeHabits.filter(
        (habit) => habit.reminderTime !== null && habit.reminderTime !== ''
      );

      logger.info(`Found ${habitsWithReminders.length} habits with reminders`);

      // Get current date/time in JST
      const nowUtc = new Date();
      const jstNow = nowInJst();
      const { year, month, day, dayOfWeek } = getJstDateComponents(jstNow);

      let created = 0;

      for (const habit of habitsWithReminders) {
        try {
          // Check if habit should run today
          const shouldRunToday = this.shouldHabitRunToday(habit, dayOfWeek);
          if (!shouldRunToday) {
            continue;
          }

          // Parse reminder time (stored as JST, e.g., "09:00")
          const [hours, minutes] = habit.reminderTime!.split(':').map(Number);

          // Create UTC date for reminder time
          const reminderTimeUtc = createJstDate(year, month, day, hours, minutes);

          // Only create if reminder is in the future
          if (reminderTimeUtc <= nowUtc) {
            logger.info(`Reminder time already passed for habit ${habit.id}, skipping`);
            continue;
          }

          // Check if reminder already exists
          if (await this.reminderExists(habit.userId, habit.name, reminderTimeUtc)) {
            logger.info(`Reminder already exists for habit ${habit.id}`);
            continue;
          }

          // Create reminder
          await this.db.insert(reminders).values({
            userId: habit.userId,
            taskId: null,
            reminderTime: reminderTimeUtc,
            message: `Habit reminder: ${habit.name}`,
            sent: false,
            platform: null
          });

          created++;
          logger.info(
            `Created reminder for habit ${habit.id} (${habit.name}) at ${reminderTimeUtc.toISOString()}`
          );
        } catch (error) {
          logger.error(error, `Failed to create reminder for habit ${habit.id}`);
        }
      }

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
    const existing = await this.db.query.reminders.findFirst({
      where: and(
        eq(reminders.userId, userId),
        eq(reminders.sent, false),
        lte(reminders.reminderTime, reminderTime),
        eq(reminders.message, `Habit reminder: ${habitName}`)
      )
    });

    return !!existing;
  }
}
