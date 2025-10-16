import { Elysia, t } from 'elysia';
import { eq, and, desc, gte } from 'drizzle-orm';
import { reminders } from '../../../drizzle/schema';
import { withAuth } from '../auth/withAuth';

export const remindersRoutes = new Elysia({ prefix: '/reminders' })
  .use(withAuth())
  // Get upcoming reminders for the current user (not sent, future only)
  .get(
    '/',
    async ({ user, db }) => {
      const now = new Date();

      const userReminders = await db
        .select()
        .from(reminders)
        .where(
          and(
            eq(reminders.userId, user.id),
            eq(reminders.sent, false),
            gte(reminders.reminderTime, now)
          )
        )
        .orderBy(desc(reminders.reminderTime));

      return userReminders;
    },
    {
      detail: {
        tags: ['Reminders'],
        summary: 'Get upcoming reminders',
        description: 'Get all upcoming reminders for the current user (not sent, future only)'
      }
    }
  )
  // Get a specific reminder
  .get(
    '/:id',
    async ({ params, user, db, set }) => {
      const reminder = await db.query.reminders.findFirst({
        where: and(eq(reminders.id, params.id), eq(reminders.userId, user.id))
      });

      if (!reminder) {
        set.status = 404;
        return { message: 'Reminder not found' };
      }

      return reminder;
    },
    {
      params: t.Object({
        id: t.String()
      }),
      detail: {
        tags: ['Reminders'],
        summary: 'Get a reminder',
        description: 'Get a specific reminder by ID'
      }
    }
  )
  // Create a new reminder
  .post(
    '/',
    async ({ body, user, db }) => {
      const [reminder] = await db
        .insert(reminders)
        .values({
          userId: user.id,
          taskId: body.taskId || null,
          reminderTime: new Date(body.reminderTime),
          message: body.message,
          platform: body.platform || null,
          sent: false
        })
        .returning();

      return reminder;
    },
    {
      body: t.Object({
        taskId: t.Optional(t.String()),
        reminderTime: t.String(), // ISO timestamp
        message: t.String({ minLength: 1 }),
        platform: t.Optional(t.String())
      }),
      detail: {
        tags: ['Reminders'],
        summary: 'Create a reminder',
        description: 'Create a new reminder'
      }
    }
  )
  // Update a reminder
  .patch(
    '/:id',
    async ({ params, body, user, db, set }) => {
      // Check if reminder exists and belongs to user
      const existing = await db.query.reminders.findFirst({
        where: and(eq(reminders.id, params.id), eq(reminders.userId, user.id))
      });

      if (!existing) {
        set.status = 404;
        return { message: 'Reminder not found' };
      }

      const [updated] = await db
        .update(reminders)
        .set({
          reminderTime: body.reminderTime ? new Date(body.reminderTime) : undefined,
          message: body.message,
          platform: body.platform
        })
        .where(eq(reminders.id, params.id))
        .returning();

      return updated;
    },
    {
      params: t.Object({
        id: t.String()
      }),
      body: t.Object({
        reminderTime: t.Optional(t.String()),
        message: t.Optional(t.String({ minLength: 1 })),
        platform: t.Optional(t.String())
      }),
      detail: {
        tags: ['Reminders'],
        summary: 'Update a reminder',
        description: 'Update an existing reminder'
      }
    }
  )
  // Delete a reminder
  .delete(
    '/:id',
    async ({ params, user, db, set }) => {
      // Check if reminder exists and belongs to user
      const existing = await db.query.reminders.findFirst({
        where: and(eq(reminders.id, params.id), eq(reminders.userId, user.id))
      });

      if (!existing) {
        set.status = 404;
        return { message: 'Reminder not found' };
      }

      await db.delete(reminders).where(eq(reminders.id, params.id));

      return { success: true, message: 'Reminder deleted' };
    },
    {
      params: t.Object({
        id: t.String()
      }),
      detail: {
        tags: ['Reminders'],
        summary: 'Delete a reminder',
        description: 'Delete a reminder'
      }
    }
  );
