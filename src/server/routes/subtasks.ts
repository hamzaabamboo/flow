import { Elysia, t } from 'elysia';
import { eq, sql } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { subtasks } from '../../../drizzle/schema';
import { wsManager } from '../websocket';
import { errorResponse, successResponse } from '../utils/errors';
import { verifyTaskOwnership, verifySubtaskOwnership } from '../utils/ownership';

export const subtasksRoutes = new Elysia({ prefix: '/subtasks' })
  .use(withAuth())
  .get(
    '/task/:taskId',
    async ({ params, db, user, set }) => {
      // Verify task ownership
      if (!(await verifyTaskOwnership(db, params.taskId, user.id))) {
        set.status = 404;
        return errorResponse('Task not found');
      }

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
    async ({ body, db, user, set }) => {
      // Verify task ownership
      if (!(await verifyTaskOwnership(db, body.taskId, user.id))) {
        set.status = 404;
        return errorResponse('Task not found');
      }

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
      wsManager.broadcastToUser(user.id, {
        type: 'subtask-update',
        data: { taskId: body.taskId, subtaskId: newSubtask.id, action: 'created' }
      });

      return successResponse(newSubtask, 'Subtask created');
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
    async ({ params, body, db, user, set }) => {
      // Verify subtask ownership
      if (!(await verifySubtaskOwnership(db, params.id, user.id))) {
        set.status = 404;
        return errorResponse('Subtask not found');
      }

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
      wsManager.broadcastToUser(user.id, {
        type: 'subtask-update',
        data: { taskId: updated.taskId, subtaskId: updated.id, action: 'updated' }
      });

      return successResponse(updated, 'Subtask updated');
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
    async ({ params, db, user, set }) => {
      // Verify subtask ownership
      if (!(await verifySubtaskOwnership(db, params.id, user.id))) {
        set.status = 404;
        return errorResponse('Subtask not found');
      }

      const [deleted] = await db.delete(subtasks).where(eq(subtasks.id, params.id)).returning();

      // Broadcast subtask deletion
      wsManager.broadcastToUser(user.id, {
        type: 'subtask-update',
        data: { taskId: deleted.taskId, subtaskId: deleted.id, action: 'deleted' }
      });

      return successResponse(deleted, 'Subtask deleted');
    },
    {
      params: t.Object({ id: t.String() })
    }
  )
  .post(
    '/reorder',
    async ({ body, db, user, set }) => {
      const { taskId, subtaskIds } = body;

      // Verify task ownership
      if (!(await verifyTaskOwnership(db, taskId, user.id))) {
        set.status = 404;
        return errorResponse('Task not found');
      }

      // Use transaction for atomic reorder
      await db.transaction(async (tx) => {
        await Promise.all(
          subtaskIds.map((id, i) =>
            tx.update(subtasks).set({ order: i }).where(eq(subtasks.id, id))
          )
        );
      });

      // Broadcast reorder
      wsManager.broadcastToUser(user.id, {
        type: 'subtask-update',
        data: { taskId, subtaskId: '', action: 'reordered' }
      });

      return successResponse(null, 'Subtasks reordered');
    },
    {
      body: t.Object({
        taskId: t.String(),
        subtaskIds: t.Array(t.String())
      })
    }
  );
