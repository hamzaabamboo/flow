import { Elysia, t } from 'elysia';
import { eq, and, gte } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { habits, habitLogs } from '../../../drizzle/schema';

export const habitsRoutes = new Elysia({ prefix: '/habits' })
  .use(withAuth())
  .get('/', async ({ query, db, user }) => {
    // Get space filter from query
    const space = query.space || 'work';

    // If date is provided, only show active habits (Agenda view)
    // If no date, show all habits including disabled (Habits management page)
    const conditions = [eq(habits.userId, user.id), eq(habits.space, space)];
    if (query.date) {
      conditions.push(eq(habits.active, true));
    }

    // Fetch habits for the user filtered by space
    const allHabits = await db
      .select()
      .from(habits)
      .where(and(...conditions))
      .orderBy(habits.name);

    // If date is provided, filter by day of week for weekly habits (Agenda view)
    // If no date, return all habits (Habits management page)
    let userHabits = allHabits;

    if (query.date) {
      const queryDate = new Date(String(query.date));
      queryDate.setHours(0, 0, 0, 0);
      const dayOfWeek = queryDate.getDay(); // 0 = Sun, 1 = Mon, etc.

      // Filter habits based on frequency and target days
      userHabits = allHabits.filter((habit) => {
        if (habit.frequency === 'daily') return true;
        if (habit.frequency === 'weekly' && habit.targetDays) {
          return habit.targetDays.includes(dayOfWeek);
        }
        return false;
      });
    }

    // Check completion status for each habit
    // Use query date if provided, otherwise use today for completion check
    const checkDate = query.date ? new Date(String(query.date)) : new Date();
    checkDate.setHours(0, 0, 0, 0);

    const habitsWithStatus = await Promise.all(
      userHabits.map(async (habit) => {
        const [log] = await db
          .select()
          .from(habitLogs)
          .where(and(eq(habitLogs.habitId, habit.id), gte(habitLogs.date, checkDate)))
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
    async ({ params, db, _user }) => {
      // Check if already logged today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [existingLog] = await db
        .select()
        .from(habitLogs)
        .where(and(eq(habitLogs.habitId, params.id), gte(habitLogs.date, today)));

      if (existingLog) {
        // Toggle completion
        const [updated] = await db
          .update(habitLogs)
          .set({
            completed: !existingLog.completed,
            completedAt: !existingLog.completed ? new Date() : existingLog.completedAt
          })
          .where(eq(habitLogs.id, existingLog.id))
          .returning();
        return updated;
      }

      // Create new log
      const [newLog] = await db
        .insert(habitLogs)
        .values({
          habitId: params.id,
          date: today,
          completedAt: new Date(),
          completed: true
        })
        .returning();
      return newLog;
    },
    {
      params: t.Object({ id: t.String() })
    }
  );
