import { Elysia, t } from 'elysia';
import { eq, and, gte } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { pomodoroSessions } from '../../../drizzle/schema';

export const pomodoroRoutes = new Elysia({ prefix: '/pomodoro' })
  .use(withAuth())
  .get('/', async ({ db, user }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessions = await db
      .select()
      .from(pomodoroSessions)
      .where(and(eq(pomodoroSessions.userId, user.id), gte(pomodoroSessions.startTime, today)));
    return sessions;
  })
  .post(
    '/',
    async ({ body, db, user }) => {
      const [session] = await db
        .insert(pomodoroSessions)
        .values({
          ...body,
          userId: user.id,
          startTime: new Date(body.startTime)
        })
        .returning();
      return session;
    },
    {
      body: t.Object({
        taskId: t.Optional(t.String()),
        duration: t.Number(),
        startTime: t.String()
      })
    }
  );
