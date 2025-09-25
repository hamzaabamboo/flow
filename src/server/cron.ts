import { Elysia } from 'elysia';
import { cron } from '@elysiajs/cron';
import { and, eq, lte } from 'drizzle-orm';
import { reminders } from '../../drizzle/schema';
import { db, type Database } from './db';
import { HamBotIntegration } from './integrations/hambot';
import { wsManager } from './websocket';

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

export const reminderCron = new Elysia().decorate('db', db).use(
  cron({
    name: 'reminder-checker',
    pattern: '*/1 * * * *', // Check every minute
    async run() {
      console.log('Checking for reminders...');

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

          console.log(`Reminder sent: ${reminder.id}`);
        } catch (error) {
          console.error(`Failed to send reminder ${reminder.id}:`, error);
        }
      }
    }
  })
);
