import { Elysia, t } from 'elysia';
import { and, eq, gte, lte, desc, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { db } from '../db';
import { habits, habitLogs } from '../../../drizzle/schema';

interface User {
  id: string;
  email: string;
}

export const habitRoutes = new Elysia({ prefix: '/habits' })
  .decorate('db', db)

  // Get all habits for user
  .get('/', async ({ db, user }) => {
    const userHabits = await db
      .select()
      .from(habits)
      .where(eq(habits.userId, user.id))
      .orderBy(habits.name);

    // Get today's logs for each habit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayLogs = await db
      .select()
      .from(habitLogs)
      .where(
        and(
          inArray(
            habitLogs.habitId,
            userHabits.map((h) => h.id)
          ),
          gte(habitLogs.date || habitLogs.completedAt, today),
          lte(habitLogs.date || habitLogs.completedAt, tomorrow)
        )
      );

    // Calculate streaks for each habit
    const habitsWithStatus = await Promise.all(
      userHabits.map(async (habit) => {
        const todayLog = todayLogs.find((log) => log.habitId === habit.id);
        const streak = await calculateStreak(db, habit.id);

        return { ...habit, completedToday: todayLog?.completed || false, currentStreak: streak };
      })
    );

    return habitsWithStatus;
  })

  // Create a new habit
  .post(
    '/',
    async ({ body, db, user }) => {
      const [newHabit] = await db
        .insert(habits)
        .values({
          ...body,
          userId: user.id,
          space: body.space || 'personal'
        })
        .returning();

      return newHabit;
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.Optional(t.String()),
        frequency: t.Union([t.Literal('daily'), t.Literal('weekly')]),
        targetDays: t.Optional(t.Array(t.Number())), // For weekly habits: [0,1,2,3,4] = weekdays
        color: t.Optional(t.String()),
        space: t.Optional(t.Union([t.Literal('work'), t.Literal('personal')]))
      })
    }
  )

  // Update a habit
  .patch(
    '/:habitId',
    async ({ params, body, db, user }) => {
      const [updatedHabit] = await db
        .update(habits)
        .set(body)
        .where(and(eq(habits.id, params.habitId), eq(habits.userId, user.id)))
        .returning();

      return updatedHabit;
    },
    {
      params: t.Object({ habitId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        frequency: t.Optional(t.Union([t.Literal('daily'), t.Literal('weekly')])),
        targetDays: t.Optional(t.Array(t.Number())),
        color: t.Optional(t.String())
      })
    }
  )

  // Delete a habit
  .delete(
    '/:habitId',
    async ({ params, db, user }) => {
      await db.delete(habits).where(and(eq(habits.id, params.habitId), eq(habits.userId, user.id)));

      return { success: true };
    },
    { params: t.Object({ habitId: t.String() }) }
  )

  // Toggle habit completion for today
  .post(
    '/:habitId/toggle',
    async ({ params, db }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if log exists for today
      const [existingLog] = await db
        .select()
        .from(habitLogs)
        .where(and(eq(habitLogs.habitId, params.habitId), eq(habitLogs.date, today)))
        .limit(1);

      if (existingLog) {
        // Toggle existing log
        const [updatedLog] = await db
          .update(habitLogs)
          .set({ completed: !existingLog.completed })
          .where(eq(habitLogs.id, existingLog.id))
          .returning();

        return updatedLog;
      } else {
        // Create new log
        const [newLog] = await db
          .insert(habitLogs)
          .values({
            habitId: params.habitId,
            date: today,
            completedAt: today,
            completed: true
          })
          .returning();

        return newLog;
      }
    },
    { params: t.Object({ habitId: t.String() }) }
  )

  // Get habit history
  .get(
    '/:habitId/history',
    async ({ params, query, db }) => {
      const { days = 30 } = query;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const logs = await db
        .select()
        .from(habitLogs)
        .where(and(eq(habitLogs.habitId, params.habitId), gte(habitLogs.date, startDate)))
        .orderBy(desc(habitLogs.completedAt));

      return logs;
    },
    { params: t.Object({ habitId: t.String() }), query: t.Object({ days: t.Optional(t.Number()) }) }
  )

  // Get habit statistics
  .get('/stats', async ({ db, user }) => {
    const userHabits = await db.select().from(habits).where(eq(habits.userId, user.id));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const habitIds = userHabits.map((h) => h.id);
    const logs = await db
      .select()
      .from(habitLogs)
      .where(and(inArray(habitLogs.habitId, habitIds), gte(habitLogs.completedAt, thirtyDaysAgo)));

    // Calculate statistics
    const stats = {
      totalHabits: userHabits.length,
      completedToday: logs.filter((log) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const logDate = log.date || log.completedAt;
        return logDate && logDate >= today && log.completed;
      }).length,
      completionRate:
        logs.length > 0
          ? Math.round((logs.filter((l) => l.completed).length / logs.length) * 100)
          : 0,
      longestStreak: 0, // Would need more complex calculation
      currentStreaks: await Promise.all(
        userHabits.map(async (habit) => ({
          habitName: habit.name,
          streak: await calculateStreak(db, habit.id)
        }))
      )
    };

    return stats;
  });

// Helper function to calculate current streak
async function calculateStreak(db: PostgresJsDatabase, habitId: string): Promise<number> {
  const logs = await db
    .select()
    .from(habitLogs)
    .where(eq(habitLogs.habitId, habitId))
    .orderBy(desc(habitLogs.completedAt));

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < logs.length; i++) {
    const logDateValue = logs[i].date || logs[i].completedAt;
    if (!logDateValue) continue;

    const logDate = new Date(logDateValue);
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);

    if (logDate.toDateString() === expectedDate.toDateString() && logs[i].completed) {
      streak++;
    } else if (i === 0 && logDate < today) {
      // If no log for today yet, check yesterday
      continue;
    } else {
      break;
    }
  }

  return streak;
}
