import { Elysia, t } from 'elysia';
import { eq, and, gte, lte, inArray, count } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { habits, habitLogs } from '../../../drizzle/schema';

export const habitsRoutes = new Elysia({ prefix: '/habits' })
  .use(withAuth())
  .get('/', async ({ query, db, user }) => {
    const space = query.space || 'work';
    const view = query.view || 'day';

    const conditions = [eq(habits.userId, user.id), eq(habits.space, space)];
    if (query.date) {
      conditions.push(eq(habits.active, true));
    }

    const allHabits = await db
      .select()
      .from(habits)
      .where(and(...conditions))
      .orderBy(habits.name);

    // For week view, return habits for each day of the week
    if (view === 'week' && query.date) {
      // Parse date string directly as UTC
      const weekStartDate = new Date(`${query.date}T00:00:00.000Z`);
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);

      // Fetch all habit logs for the week in a single query
      const habitIds = allHabits.map((h) => h.id);
      const allLogs =
        habitIds.length > 0
          ? await db
              .select()
              .from(habitLogs)
              .where(
                and(
                  inArray(habitLogs.habitId, habitIds),
                  gte(habitLogs.date, weekStartDate),
                  lte(habitLogs.date, weekEndDate)
                )
              )
          : [];

      // Create a map for quick lookup: habitId_dateStr -> log
      const logMap = new Map<string, (typeof allLogs)[0]>();
      for (const log of allLogs) {
        if (log.date) {
          const dateStr = log.date.toISOString().split('T')[0];
          logMap.set(`${log.habitId}_${dateStr}`, log);
        }
      }

      const results = [];

      // For each day in the week
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(weekStartDate);
        currentDate.setUTCDate(weekStartDate.getUTCDate() + i);
        const dayOfWeek = currentDate.getUTCDay();
        const dateStr = currentDate.toISOString().split('T')[0];

        // Filter habits for this day
        const dayHabits = allHabits.filter((habit) => {
          if (habit.frequency === 'daily') return true;
          if (habit.frequency === 'weekly' && habit.targetDays) {
            return habit.targetDays.includes(dayOfWeek);
          }
          return false;
        });

        // Get completion status for each habit on this day
        for (const habit of dayHabits) {
          const log = logMap.get(`${habit.id}_${dateStr}`);

          results.push({
            ...habit,
            link: habit.metadata?.link,
            completedToday: log?.completed || false,
            currentStreak: 0,
            checkDate: dateStr
          });
        }
      }

      return results;
    }

    // Day view - original logic
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
          link: habit.metadata?.link,
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
      const metadata = body.link ? { link: body.link } : {};

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
          color: body.color || '#3b82f6',
          metadata
        })
        .returning();
      return {
        ...newHabit,
        link: newHabit.metadata?.link
      };
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.Optional(t.String()),
        frequency: t.String(),
        space: t.Optional(t.String()),
        targetDays: t.Optional(t.Array(t.Number())),
        reminderTime: t.Optional(t.String()),
        color: t.Optional(t.String()),
        link: t.Optional(t.String())
      })
    }
  )
  .patch(
    '/:id',
    async ({ params, body, db, user }) => {
      // First, get the current habit to preserve existing metadata
      const [currentHabit] = await db.select().from(habits).where(eq(habits.id, params.id));

      if (!currentHabit) throw new Error('Habit not found');

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
      if (body.link !== undefined) {
        updateData.metadata = { ...currentHabit.metadata, link: body.link };
      }

      const [updated] = await db
        .update(habits)
        .set(updateData)
        .where(and(eq(habits.id, params.id), eq(habits.userId, user.id)))
        .returning();
      return {
        ...updated,
        link: updated.metadata?.link
      };
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
        active: t.Optional(t.Boolean()),
        link: t.Optional(t.String())
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
  )
  .get('/:id/stats', async ({ params, db, user }) => {
    // Verify habit ownership
    const [habit] = await db
      .select()
      .from(habits)
      .where(and(eq(habits.id, params.id), eq(habits.userId, user.id)));

    if (!habit) {
      return { error: 'Habit not found' };
    }

    // Get total completions
    const [completionCount] = await db
      .select({ count: count() })
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, params.id), eq(habitLogs.completed, true)));

    const totalCompletions = completionCount?.count || 0;

    // Calculate expected occurrences based on habit frequency
    // Use creation date to current date as the range
    const habitCreatedAt = habit.createdAt || new Date();
    const now = new Date();
    const daysSinceCreation = Math.floor(
      (now.getTime() - habitCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    let expectedOccurrences = 0;
    if (habit.frequency === 'daily') {
      expectedOccurrences = daysSinceCreation + 1; // +1 to include today
    } else if (habit.frequency === 'weekly' && habit.targetDays) {
      // Calculate how many times the target days occurred since creation
      const weeksSinceCreation = Math.floor(daysSinceCreation / 7);
      const remainingDays = daysSinceCreation % 7;
      expectedOccurrences = weeksSinceCreation * habit.targetDays.length;

      // Add remaining days
      for (let i = 0; i <= remainingDays; i++) {
        const checkDate = new Date(habitCreatedAt);
        checkDate.setDate(habitCreatedAt.getDate() + i);
        if (habit.targetDays.includes(checkDate.getDay())) {
          expectedOccurrences++;
        }
      }
    }

    const completionRate =
      expectedOccurrences > 0 ? Math.round((totalCompletions / expectedOccurrences) * 100) : 0;

    return {
      totalCompletions,
      expectedOccurrences,
      completionRate,
      habitId: params.id
    };
  });
