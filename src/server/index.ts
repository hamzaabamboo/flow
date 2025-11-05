import { join } from 'path';
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import { wrap } from '@bogeychan/elysia-logger';
import { renderPage } from 'vike/server';
import { connect } from 'elysia-connect-middleware';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

import { db } from './db';
import { logger } from './logger';
import { webhookRoutes } from './routes/webhook';
import { calendarRoutes, publicCalendarRoutes } from './routes/calendar';
import { boardRoutes } from './routes/boards';
import { columnsRoutes } from './routes/columns';
import { tasksRoutes } from './routes/tasks';
import { subtasksRoutes } from './routes/subtasks';
import { inboxRoutes } from './routes/inbox';
import { pomodoroRoutes } from './routes/pomodoro';
import { habitsRoutes } from './routes/habits';
import { commandRoutes } from './routes/command';
import { searchRoutes } from './routes/search';
import { settingsRoutes } from './routes/settings';
import { autoOrganizeRoutes } from './routes/autoOrganize';
import { remindersRoutes } from './routes/reminders';
import { statsRoutes } from './routes/stats';
import { apiTokensRoutes } from './routes/api-tokens';
import { externalCalendarsRoutes } from './routes/external-calendars';
import { notesRoutes } from './routes/notes';
import { oidcAuth } from './auth/oidc';
import { cronJobs } from './cron';
import { HabitReminderService } from './services/habit-reminder-service';
import { HamBotIntegration } from './integrations/hambot';
import { wsManager } from './websocket';
import { users } from 'drizzle/schema';

const _app = new Elysia({
  serve: {
    port: 3000,
    idleTimeout: 60
  }
})
  // Add logger middleware
  .use(wrap(logger, { autoLogging: false }));

const isProduction = process.env.NODE_ENV === 'production';
const root = join(process.cwd());

// Vike SSR setup
if (!isProduction) {
  const { createDevMiddleware } = await import('vike/server');
  const { devMiddleware } = await createDevMiddleware({ root });
  _app.use(connect(devMiddleware));
} else {
  // In production, serve static assets
  _app.use(
    staticPlugin({
      assets: join(root, 'dist', 'client'),
      prefix: '/'
    })
  );
}

const app = _app
  .use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3001',
      credentials: true
    })
  )
  .use(cookie())
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'your-secret-key'
    })
  )
  .state('db', db)
  // OAuth/OIDC auth routes (public)
  .use(oidcAuth)
  // Public webhook endpoints
  .use(webhookRoutes)
  // Public calendar iCal feed
  .use(publicCalendarRoutes)
  // Cron jobs
  .use(cronJobs)
  // Protected API Routes
  .group('/api', (api) =>
    api
      .use(boardRoutes)
      .use(columnsRoutes)
      .use(tasksRoutes)
      .use(subtasksRoutes)
      .use(inboxRoutes)
      .use(pomodoroRoutes)
      .use(habitsRoutes)
      .use(commandRoutes)
      .use(searchRoutes)
      .use(settingsRoutes)
      .use(calendarRoutes)
      .use(remindersRoutes)
      .use(statsRoutes)
      .use(apiTokensRoutes)
      .use(externalCalendarsRoutes)
      .use(autoOrganizeRoutes)
      .use(notesRoutes)
  )
  // WebSocket for real-time updates
  .ws('/ws', {
    async open(ws) {
      const url = new URL(ws.data.request.url);
      const token = url.searchParams.get('token');

      let userId: string | null = null;

      // Authenticate user from token
      if (token) {
        try {
          // Simple JWT decode (header.payload.signature)
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.userId) {
              userId = payload.userId as string;
            }
          }
        } catch {
          logger.warn('Invalid WebSocket token');
        }
      }

      logger.info(`WebSocket client connected${userId ? ` (user: ${userId})` : ' (anonymous)'}`);

      // Subscribe to user-specific channel if authenticated
      if (userId) {
        ws.subscribe(`user:${userId}`);
        logger.info(`Subscribed to channel: user:${userId}`);
      }

      // Also subscribe to global channel for system-wide messages
      ws.subscribe('global');

      // Send a ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === 1) {
          // OPEN state
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);

      // Store interval ID and userId for cleanup
      (ws as unknown as { data?: { pingInterval: NodeJS.Timeout; userId?: string } }).data = {
        pingInterval,
        userId: userId || undefined
      };
    },
    message(ws, message) {
      // Echo messages back (optional, can be removed)
      const wsData = (ws as unknown as { data?: { userId?: string } }).data;
      if (wsData?.userId) {
        ws.publish(`user:${wsData.userId}`, message);
      }
    },
    close(ws, code, reason) {
      const wsData = (ws as unknown as { data?: { pingInterval: NodeJS.Timeout; userId?: string } })
        .data;

      logger.info(`WebSocket client disconnected (code: ${code}, reason: ${reason})`);

      // Clean up ping interval
      if (wsData?.pingInterval) {
        clearInterval(wsData.pingInterval);
      }

      // Unsubscribe from channels
      if (wsData?.userId) {
        ws.unsubscribe(`user:${wsData.userId}`);
      }
      ws.unsubscribe('global');
    },
    error(ctx) {
      logger.error(ctx, 'WebSocket error');
    }
  })
  // Catch-all route for SSR (must be last)
  .get('/*', async ({ request, cookie, jwt }) => {
    // Check for authentication and add user to pageContext
    let user = null;
    let token = cookie.auth.value;

    // Auto-login in development if no token
    if (!token && !isProduction) {
      logger.info('No auth token found - auto-logging in as first user (development mode)');

      // Get the first user from database
      const [firstUser] = await db.select().from(users).limit(1);

      if (firstUser) {
        // Create JWT token for this user
        const autoToken = await jwt.sign({
          userId: firstUser.id,
          email: firstUser.email,
          name: firstUser.name
        });

        // Set cookie
        cookie.auth.set({
          value: autoToken,
          httpOnly: true,
          secure: false, // Development
          sameSite: 'lax',
          maxAge: 30 * 86400, // 30 days
          path: '/'
        });

        logger.info(`Auto-logged in as: ${firstUser.email}`);

        user = {
          id: firstUser.id,
          email: firstUser.email,
          name: firstUser.name
        };

        token = autoToken;
      }
    }

    if (token && !user) {
      try {
        const payload = await jwt.verify(token as string);
        if (payload) {
          const [dbUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, payload.userId as string));

          if (dbUser) {
            user = {
              id: dbUser.id,
              email: dbUser.email,
              name: dbUser.name
            };
          }
        }
      } catch {
        // Invalid token, continue as unauthenticated
      }
    }

    const pageContextInit = {
      urlOriginal: request.url,
      user,
      headers: Object.fromEntries(request.headers.entries())
    };
    const pageContext = await renderPage(pageContextInit);
    const { httpResponse } = pageContext;

    if (!httpResponse) {
      return new Response('Not Found', { status: 404 });
    }

    const { body, statusCode, headers } = httpResponse;
    return new Response(body, {
      status: statusCode,
      headers: headers as HeadersInit
    });
  })
  .onError(({ error, set }) => {
    logger.error(error, 'Server error');
    set.status = 500;
    return { error: 'Internal server error' };
  })
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

    // Initialize WebSocket manager
    wsManager.setApp(app);

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

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ promise, reason }, 'Unhandled Rejection');
  gracefulShutdown();
});

export type App = typeof app;
