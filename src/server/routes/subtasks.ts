import { Elysia, t } from 'elysia';
import { eq, sql } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { subtasks } from '../../../drizzle/schema';
import { wsManager } from '../websocket';

export const subtasksRoutes = new Elysia({ prefix: '/subtasks' })
  .use(withAuth())
  .get(
    '/task/:taskId',
    async ({ params, db }) => {
      const taskSubtasks = await db
        .select()
        .from(subtasks)
        .where(eq(subtasks.taskId, params.taskId))
        .orderBy(subtasks.order);
      return taskSubtasks;
    },
    {
      params: t.Object({ taskId: t.String() })
    }
  )
  .post(
    '/',
    async ({ body, db }) => {
      // Get the highest order value for this task's subtasks
      const existingSubtasks = await db
        .select({ maxOrder: sql`MAX(${subtasks.order})` })
        .from(subtasks)
        .where(eq(subtasks.taskId, body.taskId));

      const nextOrder = ((existingSubtasks[0]?.maxOrder as number) || 0) + 1;

      const [newSubtask] = await db
        .insert(subtasks)
        .values({
          taskId: body.taskId,
          title: body.title,
          completed: false,
          order: nextOrder
        })
        .returning();

      // Broadcast subtask creation
      wsManager.broadcastSubtaskUpdate(body.taskId, newSubtask.id, 'created');

      return newSubtask;
    },
    {
      body: t.Object({
        taskId: t.String(),
        title: t.String()
      })
    }
  )
  .patch(
    '/:id',
    async ({ params, body, db }) => {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date()
      };

      if (body.title !== undefined) updateData.title = body.title;
      if (body.completed !== undefined) updateData.completed = body.completed;
      if (body.order !== undefined) updateData.order = body.order;

      const [updated] = await db
        .update(subtasks)
        .set(updateData)
        .where(eq(subtasks.id, params.id))
        .returning();

      // Broadcast subtask update
      wsManager.broadcastSubtaskUpdate(updated.taskId, updated.id, 'updated');

      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.Optional(t.String()),
        completed: t.Optional(t.Boolean()),
        order: t.Optional(t.Number())
      })
    }
  )
  .delete(
    '/:id',
    async ({ params, db }) => {
      const [deleted] = await db.delete(subtasks).where(eq(subtasks.id, params.id)).returning();

      // Broadcast subtask deletion
      wsManager.broadcastSubtaskUpdate(deleted.taskId, deleted.id, 'deleted');

      return deleted;
    },
    {
      params: t.Object({ id: t.String() })
    }
  )
  .post(
    '/reorder',
    async ({ body, db }) => {
      const { taskId, subtaskIds } = body;

      // Update the order of each subtask
      const updatePromises = subtaskIds.map((id: string, index: number) =>
        db.update(subtasks).set({ order: index }).where(eq(subtasks.id, id))
      );

      await Promise.all(updatePromises);

      // Broadcast reorder
      wsManager.broadcastSubtaskUpdate(taskId, '', 'reordered');

      return { success: true };
    },
    {
      body: t.Object({
        taskId: t.String(),
        subtaskIds: t.Array(t.String())
      })
    }
  );
