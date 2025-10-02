import { Elysia } from 'elysia';
import { cron } from '@elysiajs/cron';
import { and, eq, lte } from 'drizzle-orm';
import { reminders, users } from '../../drizzle/schema';
import { MORNING_SUMMARY_HOUR_UTC, EVENING_SUMMARY_HOUR_UTC } from '../shared/constants';
import { db, type Database } from './db';
import { HamBotIntegration } from './integrations/hambot';
import { SummaryService } from './services/summary-service';
import { wsManager } from './websocket';
import { logger } from './logger';

interface Reminder {
  id: string;
  message: string;
  userId: string;
  reminderTime: Date;
}

async function sendToHamBot(reminder: Reminder, db: Database) {
  const hambot = new HamBotIntegration(db);

  // Send via HamBot if configured
  if (hambot.isConfigured()) {
    await hambot.sendReminder(reminder.userId, reminder.message);
  }

  // Also send via WebSocket for in-app notification
  wsManager.sendReminder(reminder.userId, reminder.message);
}

export async function sendDailySummary(
  userId: string,
  type: 'morning' | 'evening',
  spaces: ('work' | 'personal')[],
  db: Database
): Promise<{ success: boolean; summary: string; sent: boolean }> {
  const hambot = new HamBotIntegration(db);
  const summaryService = new SummaryService(db);

  // Generate summary
  const summary =
    type === 'morning'
      ? await summaryService.generateMorningSummary(userId, spaces)
      : await summaryService.generateEveningSummary(userId, spaces);

  // Send via HamBot if configured
  let sent = false;
  if (hambot.isConfigured()) {
    sent = await hambot.sendSummary(userId, summary);
  }

  return {
    success: true,
    summary,
    sent
  };
}

async function sendDailySummaries(type: 'morning' | 'evening') {
  try {
    const hambot = new HamBotIntegration(db);

    if (!hambot.isConfigured()) {
      logger.warn('HamBot not configured, skipping daily summaries');
      return;
    }

    // Query users who opted in for this summary type
    const settingKey = type === 'evening' ? 'eveningSummaryEnabled' : 'morningSummaryEnabled';
    const optedInUsers = await db
      .select()
      .from(users)
      .where(eq(users.settings, { [settingKey]: true }));

    logger.info(`Sending ${type} summaries to ${optedInUsers.length} opted-in users`);

    for (const user of optedInUsers) {
      try {
        const userSettings =
          (user.settings as {
            summarySpaces?: ('work' | 'personal')[];
          }) || {};

        // Default to both spaces if not specified
        const spaces = userSettings.summarySpaces || ['work', 'personal'];

        await sendDailySummary(user.id, type, spaces, db);
        logger.info(`Sent ${type} summary to user ${user.id} for spaces: ${spaces.join(', ')}`);
      } catch (error) {
        logger.error(error, `Failed to send ${type} summary to user ${user.id}`);
      }
    }
  } catch (error) {
    logger.error(error, `Failed to send ${type} summaries`);
  }
}

export const cronJobs = new Elysia()
  .decorate('db', db)
  // Reminder checker - runs every minute
  .use(
    cron({
      name: 'reminder-sender',
      pattern: '*/1 * * * *',
      async run() {
        logger.info('Checking for reminders...');

        const now = new Date();

        // Get all unsent reminders that are due
        const dueReminders = await db
          .select()
          .from(reminders)
          .where(and(eq(reminders.sent, false), lte(reminders.reminderTime, now)));

        for (const reminder of dueReminders) {
          try {
            // Send reminder via HamBot and WebSocket
            await sendToHamBot(reminder, db);

            // Mark as sent
            await db.update(reminders).set({ sent: true }).where(eq(reminders.id, reminder.id));

            logger.info(`Reminder sent: ${reminder.id}`);
          } catch (error) {
            logger.error(error, `Failed to send reminder ${reminder.id}`);
          }
        }
      }
    })
  )
  // Morning summary - 10:00 JST (01:00 UTC)
  .use(
    cron({
      name: 'morning-summary',
      pattern: `0 ${MORNING_SUMMARY_HOUR_UTC} * * *`,
      async run() {
        logger.info('Sending morning summaries...');
        await sendDailySummaries('morning');
      }
    })
  )
  // Evening summary - 22:00 JST (13:00 UTC)
  .use(
    cron({
      name: 'evening-summary',
      pattern: `0 ${EVENING_SUMMARY_HOUR_UTC} * * *`,
      async run() {
        logger.info('Sending evening summaries...');
        await sendDailySummaries('evening');
      }
    })
  )
  // Cleanup old sent reminders - runs daily at 02:00 UTC
  .use(
    cron({
      name: 'cleanup-old-reminders',
      pattern: '0 2 * * *',
      async run() {
        logger.info('Cleaning up old reminders...');

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const result = await db
          .delete(reminders)
          .where(and(eq(reminders.sent, true), lte(reminders.reminderTime, thirtyDaysAgo)));

        logger.info(`Cleaned up old reminders`);
      }
    })
  );

// Export for backwards compatibility
export const reminderCron = cronJobs;
