import { Elysia, t } from 'elysia';
import { eq, and, inArray } from 'drizzle-orm';
import { tasks } from '../../../drizzle/schema';
import { db } from '../db';
import { wsManager } from '../websocket';

interface User {
  id: string;
  email: string;
}

export const taskRoutes = new Elysia({ prefix: '/tasks' })
  .decorate('db', db)
  // Get all tasks for a column
  .get(
    '/:columnId',
    async ({ params, db }) => {
      const columnTasks = await db.select().from(tasks).where(eq(tasks.columnId, params.columnId));

      return columnTasks;
    },
    {
      params: t.Object({
        columnId: t.String()
      })
    }
  )
  // Create a new task
  .post(
    '/',
    async ({ body, db, user }) => {
      const [newTask] = await db
        .insert(tasks)
        .values({
          ...body,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          userId: user.id // Use authenticated user's ID
        })
        .returning();

      // Broadcast task creation
      wsManager.broadcastTaskUpdate(newTask.id, body.columnId, 'created');

      return newTask;
    },
    {
      body: t.Object({
        columnId: t.String(),
        title: t.String(),
        description: t.Optional(t.String()),
        dueDate: t.Optional(t.String()),
        priority: t.Optional(t.String())
      })
    }
  )
  // Update a task
  .patch(
    '/:taskId',
    async ({ params, body, db }) => {
      const [updatedTask] = await db
        .update(tasks)
        .set({
          ...body,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, params.taskId))
        .returning();

      // Broadcast task update
      wsManager.broadcastTaskUpdate(
        params.taskId,
        body.columnId || updatedTask.columnId,
        'updated'
      );

      return updatedTask;
    },
    {
      params: t.Object({
        taskId: t.String()
      }),
      body: t.Object({
        title: t.Optional(t.String()),
        description: t.Optional(t.String()),
        dueDate: t.Optional(t.String()),
        priority: t.Optional(t.String()),
        completed: t.Optional(t.Boolean()),
        columnId: t.Optional(t.String())
      })
    }
  )
  // Archive a task (mark as completed and move to a special column)
  .post(
    '/:taskId/archive',
    async ({ params, db }) => {
      const [archivedTask] = await db
        .update(tasks)
        .set({
          completed: true,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, params.taskId))
        .returning();

      // Broadcast task update
      wsManager.broadcastTaskUpdate(params.taskId, archivedTask.columnId, 'updated');

      return { success: true, task: archivedTask };
    },
    {
      params: t.Object({
        taskId: t.String()
      })
    }
  )

  // Unarchive a task
  .post(
    '/:taskId/unarchive',
    async ({ params, db }) => {
      const [unarchivedTask] = await db
        .update(tasks)
        .set({
          completed: false,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, params.taskId))
        .returning();

      // Broadcast task update
      wsManager.broadcastTaskUpdate(params.taskId, unarchivedTask.columnId, 'updated');

      return { success: true, task: unarchivedTask };
    },
    {
      params: t.Object({
        taskId: t.String()
      })
    }
  )

  // Get archived tasks
  .get(
    '/archived',
    async ({ query, db, user }) => {
      const { space: _space = 'all', limit = 50 } = query;

      const archivedTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, user.id), eq(tasks.completed, true)))
        .limit(limit);

      return archivedTasks;
    },
    {
      query: t.Object({
        space: t.Optional(t.Union([t.Literal('all'), t.Literal('work'), t.Literal('personal')])),
        limit: t.Optional(t.Number())
      })
    }
  )

  // Bulk archive tasks
  .post(
    '/archive-bulk',
    async ({ body, db, user }) => {
      const { taskIds } = body;

      const archivedTasks = await db
        .update(tasks)
        .set({
          completed: true,
          updatedAt: new Date()
        })
        .where(and(eq(tasks.userId, user.id), inArray(tasks.id, taskIds)))
        .returning();

      // Broadcast updates for each task
      archivedTasks.forEach((task: typeof tasks.$inferSelect) => {
        wsManager.broadcastTaskUpdate(task.id, task.columnId, 'updated');
      });

      return { success: true, count: archivedTasks.length };
    },
    {
      body: t.Object({
        taskIds: t.Array(t.String())
      })
    }
  )

  // Delete a task
  .delete(
    '/:taskId',
    async ({ params, db }) => {
      // Get task before deletion to know the column
      const [task] = await db.select().from(tasks).where(eq(tasks.id, params.taskId)).limit(1);

      await db.delete(tasks).where(eq(tasks.id, params.taskId));

      // Broadcast task deletion
      if (task) {
        wsManager.broadcastTaskUpdate(params.taskId, task.columnId, 'deleted');
      }

      return { success: true };
    },
    {
      params: t.Object({
        taskId: t.String()
      })
    }
  );
