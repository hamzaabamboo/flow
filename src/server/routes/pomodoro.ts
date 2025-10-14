import { Elysia, t } from 'elysia';
import { eq, and, gte } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { pomodoroSessions, pomodoroActiveState } from '../../../drizzle/schema';
import { wsManager } from '../websocket';

export const pomodoroRoutes = new Elysia({ prefix: '/pomodoro' })
  .use(withAuth())
  // Get completed sessions for today
  .get('/', async ({ db, user }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessions = await db
      .select()
      .from(pomodoroSessions)
      .where(and(eq(pomodoroSessions.userId, user.id), gte(pomodoroSessions.startTime, today)));
    return sessions;
  })
  // Save completed session
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
  )
  // Get active timer state
  .get('/active', async ({ db, user }) => {
    const [state] = await db
      .select()
      .from(pomodoroActiveState)
      .where(eq(pomodoroActiveState.userId, user.id));

    if (!state) return null;

    // If timer was running, calculate elapsed time for drift correction
    if (state.isRunning && state.startTime) {
      const elapsed = Math.floor((Date.now() - state.startTime.getTime()) / 1000);
      const newTimeLeft = Math.max(0, state.timeLeft - elapsed);

      // Update database with corrected time
      await db
        .update(pomodoroActiveState)
        .set({
          timeLeft: newTimeLeft,
          startTime: new Date(),
          updatedAt: new Date()
        })
        .where(eq(pomodoroActiveState.userId, user.id));

      return { ...state, timeLeft: newTimeLeft };
    }

    return state;
  })
  // Update active timer state
  .post(
    '/active',
    async ({ body, db, user }) => {
      const dbData = {
        userId: user.id,
        type: body.type,
        duration: body.duration,
        timeLeft: body.timeLeft,
        isRunning: body.isRunning,
        startTime: body.isRunning ? new Date() : null,
        completedSessions: body.completedSessions,
        taskId: body.taskId || null,
        taskTitle: body.taskTitle || null,
        updatedAt: new Date()
      };

      // Upsert (insert or update)
      const [state] = await db
        .insert(pomodoroActiveState)
        .values(dbData)
        .onConflictDoUpdate({
          target: pomodoroActiveState.userId,
          set: dbData
        })
        .returning();

      // Broadcast to user's connected clients
      if (body.isRunning) {
        wsManager.broadcastToUser(user.id, {
          type: 'pomodoro-state',
          data: { event: 'started', state }
        });
      } else {
        wsManager.broadcastToUser(user.id, {
          type: 'pomodoro-state',
          data: { event: 'paused', state }
        });
      }

      return { success: true, state };
    },
    {
      body: t.Object({
        type: t.Union([t.Literal('work'), t.Literal('short-break'), t.Literal('long-break')]),
        duration: t.Number(),
        timeLeft: t.Number(),
        isRunning: t.Boolean(),
        completedSessions: t.Number(),
        taskId: t.Optional(t.String()),
        taskTitle: t.Optional(t.String())
      })
    }
  )
  // Clear active timer (when completed or reset)
  .delete('/active', async ({ db, user }) => {
    await db.delete(pomodoroActiveState).where(eq(pomodoroActiveState.userId, user.id));

    wsManager.broadcastToUser(user.id, {
      type: 'pomodoro-state',
      data: { event: 'cleared', state: null }
    });

    return { success: true };
  });
