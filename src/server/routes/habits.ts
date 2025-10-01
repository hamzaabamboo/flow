import { Elysia, t } from 'elysia';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { habits, habitLogs } from '../../../drizzle/schema';

export const habitsRoutes = new Elysia({ prefix: '/habits' })
  .use(withAuth())
  .get('/', async ({ query, db, user }) => {
    const space = query.space || 'work';

    const conditions = [eq(habits.userId, user.id), eq(habits.space, space)];
    if (query.date) {
      conditions.push(eq(habits.active, true));
    }

    const allHabits = await db
      .select()
      .from(habits)
      .where(and(...conditions))
      .orderBy(habits.name);

    let userHabits = allHabits;

    if (query.date) {
      const [year, month, day] = String(query.date).split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      const dayOfWeek = localDate.getDay();

      userHabits = allHabits.filter((habit) => {
        if (habit.frequency === 'daily') return true;
        if (habit.frequency === 'weekly' && habit.targetDays) {
          return habit.targetDays.includes(dayOfWeek);
        }
        return false;
      });
    }

    const checkDate = query.date
      ? new Date(`${query.date}T00:00:00.000Z`)
      : new Date(`${new Date().toISOString().split('T')[0]}T00:00:00.000Z`);

    const habitsWithStatus = await Promise.all(
      userHabits.map(async (habit) => {
        const [log] = await db
          .select()
          .from(habitLogs)
          .where(and(eq(habitLogs.habitId, habit.id), eq(habitLogs.date, checkDate)))
          .limit(1);

        return {
          ...habit,
          completedToday: log?.completed || false,
          currentStreak: 0
        };
      })
    );

    return habitsWithStatus;
  })
  .post(
    '/',
    async ({ body, db, user }) => {
      const [newHabit] = await db
        .insert(habits)
        .values({
          name: body.name,
          description: body.description,
          space: body.space || 'work',
          userId: user.id,
          frequency: body.frequency as 'daily' | 'weekly',
          targetDays: body.targetDays || [],
          reminderTime: body.reminderTime || null,
          color: body.color || '#3b82f6'
        })
        .returning();
      return newHabit;
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.Optional(t.String()),
        frequency: t.String(),
        space: t.Optional(t.String()),
        targetDays: t.Optional(t.Array(t.Number())),
        reminderTime: t.Optional(t.String()),
        color: t.Optional(t.String())
      })
    }
  )
  .patch(
    '/:id',
    async ({ params, body, db, user }) => {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date()
      };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.frequency !== undefined) updateData.frequency = body.frequency as 'daily' | 'weekly';
      if (body.targetDays !== undefined) updateData.targetDays = body.targetDays;
      if (body.reminderTime !== undefined) updateData.reminderTime = body.reminderTime;
      if (body.color !== undefined) updateData.color = body.color;
      if (body.active !== undefined) updateData.active = body.active;

      const [updated] = await db
        .update(habits)
        .set(updateData)
        .where(and(eq(habits.id, params.id), eq(habits.userId, user.id)))
        .returning();
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        frequency: t.Optional(t.String()),
        targetDays: t.Optional(t.Array(t.Number())),
        reminderTime: t.Optional(t.String()),
        color: t.Optional(t.String()),
        active: t.Optional(t.Boolean())
      })
    }
  )
  .delete('/:id', async ({ params, db, user }) => {
    await db
      .update(habits)
      .set({ active: false })
      .where(and(eq(habits.id, params.id), eq(habits.userId, user.id)));
    return { success: true };
  })
  .post(
    '/:id/log',
    async ({ params, body, db }) => {
      const logDate = new Date(`${body.date}T00:00:00.000Z`);

      const [existingLog] = await db
        .select()
        .from(habitLogs)
        .where(and(eq(habitLogs.habitId, params.id), eq(habitLogs.date, logDate)));

      if (existingLog) {
        const [updated] = await db
          .update(habitLogs)
          .set({
            completed: body.completed,
            completedAt: new Date()
          })
          .where(eq(habitLogs.id, existingLog.id))
          .returning();
        return updated;
      }

      if (body.completed) {
        const [newLog] = await db
          .insert(habitLogs)
          .values({
            habitId: params.id,
            date: logDate,
            completedAt: new Date(),
            completed: true
          })
          .returning();
        return newLog;
      }

      return { success: true, message: 'No log to complete' };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        date: t.String(),
        completed: t.Boolean()
      })
    }
  );
