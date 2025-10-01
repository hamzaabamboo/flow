import { join } from 'path';
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { cookie } from '@elysiajs/cookie';
import { renderPage, createDevMiddleware } from 'vike/server';
import { connect } from 'elysia-connect-middleware';

import { db } from './db';
import { webhookRoutes } from './routes/webhook';
import { calendarRoutes } from './routes/calendar';
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
import { simpleAuth } from './auth/simple-auth';
import { reminderCron } from './cron';
import { wsManager } from './websocket';

const app = new Elysia({
  serve: {
    port: 3000,
    idleTimeout: 60
  }
});

const isProduction = process.env.NODE_ENV === 'production';
const root = join(process.cwd());

// Vike SSR setup
if (!isProduction) {
  const { devMiddleware } = await createDevMiddleware({ root });
  app.use(connect(devMiddleware));
} else {
  // In production, serve static assets
  app.use(
    staticPlugin({
      assets: join(root, 'dist', 'client'),
      prefix: '/'
    })
  );
}

app
  .use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3001',
      credentials: true
    })
  )
  .use(cookie())
  .state('db', db)
  // Simple auth routes (public)
  .use(simpleAuth)
  // Public webhook endpoints
  .use(webhookRoutes)
  // Cron jobs
  .use(reminderCron)
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
  )
  // WebSocket for real-time updates
  .ws('/ws', {
    open(ws) {
      console.log('WebSocket client connected');
      ws.subscribe('hamflow');

      // Send a ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === 1) {
          // OPEN state
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);

      // Store interval ID for cleanup
      (ws as { data?: { pingInterval: NodeJS.Timeout } }).data = { pingInterval };
    },
    message(ws, message) {
      // Broadcast updates to all clients
      ws.publish('hamflow', message);
    },
    close(ws, code, reason) {
      console.log(`WebSocket client disconnected (code: ${code}, reason: ${reason})`);

      // Clean up ping interval
      const wsData = (ws as { data?: { pingInterval: NodeJS.Timeout } }).data;
      if (wsData?.pingInterval) {
        clearInterval(wsData.pingInterval);
      }

      ws.unsubscribe('hamflow');
    },
    error(ws: unknown, error: Error) {
      console.error('WebSocket error:', error);

      // Clean up ping interval on error
      const wsData = (ws as { data?: { pingInterval: NodeJS.Timeout } }).data;
      if (wsData?.pingInterval) {
        clearInterval(wsData.pingInterval);
      }
    }
  })
  // Catch-all route for SSR (must be last)
  .get('/*', async ({ request }) => {
    const pageContextInit = { urlOriginal: request.url };
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
  .onError(({ code, error, set }) => {
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'Not found' };
    }
    console.error(error);
    set.status = 500;
    return { error: 'Internal server error' };
  })
  .listen(3000);

// Initialize WebSocket manager with app instance
wsManager.setApp(app);

console.log(`🚀 HamFlow server running at http://localhost:${app.server?.port}`);

// Graceful shutdown handlers
const gracefulShutdown = () => {
  console.log('Shutting down server gracefully...');

  // Close all WebSocket connections
  if (app.server) {
    // Broadcast shutdown message to all clients
    wsManager.broadcast({
      type: 'server-shutdown',
      data: { message: 'Server is shutting down' }
    });

    // Force exit after 10 seconds
    const forceExitTimeout = setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);

    // Close the server
    // Bun's server.stop() is synchronous and takes a boolean for closeActiveConnections
    app.server.stop(true);
    clearTimeout(forceExitTimeout);
    console.log('Server closed');
    process.exit(0);
  }
};

// Handle various shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown); // For nodemon restarts

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});
