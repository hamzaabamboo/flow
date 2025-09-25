import { Elysia, t } from 'elysia';
import { eq, and, desc, gte } from 'drizzle-orm';
import { pomodoroSessions } from '../../../drizzle/schema';
import { db } from '../db';

interface User {
  id: string;
  email: string;
}

export const pomodoroRoutes = new Elysia({ prefix: '/pomodoro' })
  .decorate('db', db)
  // Get pomodoro sessions for today
  .get('/', async ({ db, user }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessions = await db
      .select()
      .from(pomodoroSessions)
      .where(and(eq(pomodoroSessions.userId, user.id), gte(pomodoroSessions.createdAt, today)))
      .orderBy(desc(pomodoroSessions.createdAt));

    return sessions;
  })
  // Save a completed pomodoro session
  .post(
    '/',
    async ({ body, db, user }) => {
      const [session] = await db
        .insert(pomodoroSessions)
        .values({
          ...body,
          userId: user.id,
          startTime: new Date(),
          endTime: new Date()
        })
        .returning();

      // TODO: Broadcast update via WebSocket

      return session;
    },
    {
      body: t.Object({
        taskId: t.Optional(t.String()),
        duration: t.Number(), // in minutes
        type: t.Optional(t.String())
      })
    }
  )
  // Get statistics
  .get(
    '/stats',
    async ({ query, db, user }) => {
      const { period = 'week' } = query;

      const startDate = new Date();
      if (period === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else {
        startDate.setHours(0, 0, 0, 0);
      }

      const sessions = await db
        .select()
        .from(pomodoroSessions)
        .where(
          and(eq(pomodoroSessions.userId, user.id), gte(pomodoroSessions.createdAt, startDate))
        );

      // Calculate statistics
      const totalSessions = sessions.length;
      const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
      const averageDuration = totalSessions > 0 ? totalMinutes / totalSessions : 0;

      // Group by day
      const sessionsByDay: Record<string, number> = {};
      sessions.forEach((session) => {
        const day = session.createdAt.toISOString().split('T')[0];
        sessionsByDay[day] = (sessionsByDay[day] || 0) + 1;
      });

      return {
        totalSessions,
        totalMinutes,
        averageDuration,
        sessionsByDay
      };
    },
    {
      query: t.Object({
        period: t.Optional(t.String())
      })
    }
  );
