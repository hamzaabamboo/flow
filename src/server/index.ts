import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { join } from 'path';

import { app, _app } from './app';
import { db } from './db';
import { logger } from './logger';
import { wsManager } from './websocket';
import { HabitReminderService } from './services/habit-reminder-service';
import { HamBotIntegration } from './integrations/hambot';

const isProduction = process.env.NODE_ENV === 'production';

app
  .onStart(async () => {
    // Run database migrations
    if (isProduction) {
      try {
        logger.info('🔄 Running database migrations...');
        const migrationClient = postgres(
          process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hamflow',
          { max: 1 }
        );
        const migrationDb = drizzle(migrationClient);
        const migrationsPath = join(process.cwd(), 'drizzle', 'migrations');
        await migrate(migrationDb, { migrationsFolder: migrationsPath });
        await migrationClient.end();
        logger.info('✅ Migrations completed successfully');
      } catch (error) {
        logger.error(error, '❌ Migration failed');
        process.exit(1);
      }
    }

    try {
      // Initialize WebSocket manager
      wsManager.setApp(_app);
    } catch (error) {
      logger.error(error, 'Websocket Startup Failed');
    }

    // Check for missing habit reminders on startup
    try {
      logger.info('🔔 Checking for missing habit reminders...');
      const reminderService = new HabitReminderService(db);
      const created = await reminderService.createDailyReminders();
      logger.info(`✅ Created ${created} habit reminders`);
    } catch (error) {
      logger.error(error, 'Failed to check habit reminders on startup');
    }

    logger.info(`🚀 HamFlow server running at http://localhost:${app.server?.port}`);

    // Send debug webhook on startup (production only)
    if (isProduction) {
      try {
        const hambot = new HamBotIntegration(db);
        if (hambot.isConfigured()) {
          const startupMessage =
            `🚀 **HamFlow Server Started**\n\n` +
            `⏰ Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })} JST\n` +
            `🌐 Port: ${app.server?.port}\n` +
            `💻 Environment: ${process.env.NODE_ENV || 'production'}`;

          const success = await hambot.send(startupMessage, 'debug');
          if (success) {
            logger.info('📨 Sent startup webhook to debug channel');
          } else {
            logger.warn('Failed to send startup webhook');
          }
        }
      } catch (error) {
        logger.error(error, 'Failed to send startup webhook');
      }
    }
  })
  .listen(3000);

// Graceful shutdown handlers
const gracefulShutdown = () => {
  logger.info('Shutting down server gracefully...');

  // Close all WebSocket connections
  if (app.server) {
    // Broadcast shutdown message to all clients
    wsManager.broadcast({
      type: 'server-shutdown',
      data: { message: 'Server is shutting down' }
    });

    // Force exit after 10 seconds
    const forceExitTimeout = setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);

    // Close the server
    // Bun's server.stop() is synchronous and takes a boolean for closeActiveConnections
    app.server.stop(true);
    clearTimeout(forceExitTimeout);
    logger.info('Server closed');
    process.exit(0);
  }
};

// Handle various shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown); // For nodemon restarts

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error(error, 'Uncaught Exception');
  gracefulShutdown();
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error({ promise: await promise, reason: await reason }, 'Unhandled Rejection');
  gracefulShutdown();
});
