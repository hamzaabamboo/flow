import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { boards, columns, tasks } from '../../../drizzle/schema';
import { wsManager } from '../websocket';
import { errorResponse, successResponse } from '../utils/errors';
import { verifyBoardOwnership, verifyColumnOwnership } from '../utils/ownership';

export const columnsRoutes = new Elysia({ prefix: '/columns' })
  .use(withAuth())
  .get(
    '/:columnId',
    async ({ params, db, user, set }) => {
      // Verify column ownership
      if (!(await verifyColumnOwnership(db, params.columnId, user.id))) {
        set.status = 404;
        return errorResponse('Column not found');
      }

      const [column] = await db.select().from(columns).where(eq(columns.id, params.columnId));

      return column;
    },
    {
      params: t.Object({ columnId: t.String() })
    }
  )
  .post(
    '/',
    async ({ body, db, user, set }) => {
      // Verify board ownership
      if (!(await verifyBoardOwnership(db, body.boardId, user.id))) {
        set.status = 404;
        return errorResponse('Board not found');
      }

      // Use transaction for atomic column creation
      const result = await db.transaction(async (tx) => {
        // Get board
        const [board] = await tx.select().from(boards).where(eq(boards.id, body.boardId));

        // Create the column
        const [newColumn] = await tx
          .insert(columns)
          .values({
            boardId: body.boardId,
            name: body.name,
            taskOrder: [],
            position: body.position || 999,
            wipLimit: body.wipLimit
          })
          .returning();

        // Update board's columnOrder
        const newColumnOrder = [...((board.columnOrder as string[]) || []), newColumn.id];
        await tx
          .update(boards)
          .set({ columnOrder: newColumnOrder })
          .where(eq(boards.id, body.boardId));

        return newColumn;
      });

      // Broadcast update
      wsManager.broadcastToUser(user.id, {
        type: 'column-update',
        data: { boardId: body.boardId, columnId: result.id, action: 'created' }
      });

      return successResponse(result, 'Column created');
    },
    {
      body: t.Object({
        boardId: t.String(),
        name: t.String(),
        position: t.Optional(t.Number()),
        wipLimit: t.Optional(t.Number())
      })
    }
  )
  .patch(
    '/:columnId',
    async ({ params, body, db, user, set }) => {
      // Verify column ownership
      if (!(await verifyColumnOwnership(db, params.columnId, user.id))) {
        set.status = 404;
        return errorResponse('Column not found');
      }

      // Get column for boardId
      const [existingColumn] = await db
        .select()
        .from(columns)
        .where(eq(columns.id, params.columnId));

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.position !== undefined) updateData.position = body.position;
      if (body.wipLimit !== undefined) updateData.wipLimit = body.wipLimit;

      const [updated] = await db
        .update(columns)
        .set(updateData)
        .where(eq(columns.id, params.columnId))
        .returning();

      // Broadcast update
      wsManager.broadcastToUser(user.id, {
        type: 'column-update',
        data: { boardId: existingColumn.boardId, columnId: params.columnId, action: 'updated' }
      });

      return successResponse(updated, 'Column updated');
    },
    {
      params: t.Object({ columnId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        position: t.Optional(t.Number()),
        wipLimit: t.Optional(t.Union([t.Number(), t.Null()]))
      })
    }
  )
  .delete(
    '/:columnId',
    async ({ params, db, user, set }) => {
      // Verify column ownership
      if (!(await verifyColumnOwnership(db, params.columnId, user.id))) {
        set.status = 404;
        return errorResponse('Column not found');
      }

      // Check if column has tasks
      const columnTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.columnId, params.columnId))
        .limit(1);

      if (columnTasks.length > 0) {
        set.status = 400;
        return errorResponse('Cannot delete column with tasks');
      }

      // Use transaction for atomic deletion
      const deleted = await db.transaction(async (tx) => {
        // Get column to find boardId
        const [column] = await tx.select().from(columns).where(eq(columns.id, params.columnId));

        // Get board
        const [board] = await tx.select().from(boards).where(eq(boards.id, column.boardId));

        // Remove from board's columnOrder
        const newColumnOrder = ((board.columnOrder as string[]) || []).filter(
          (id: string) => id !== params.columnId
        );
        await tx.update(boards).set({ columnOrder: newColumnOrder }).where(eq(boards.id, board.id));

        // Delete the column
        const [result] = await tx
          .delete(columns)
          .where(eq(columns.id, params.columnId))
          .returning();

        return { column: result, boardId: board.id };
      });

      // Broadcast update
      wsManager.broadcastToUser(user.id, {
        type: 'column-update',
        data: { boardId: deleted.boardId, columnId: params.columnId, action: 'deleted' }
      });

      return successResponse(deleted.column, 'Column deleted');
    },
    {
      params: t.Object({ columnId: t.String() })
    }
  )
  .post(
    '/reorder',
    async ({ body, db, user, set }) => {
      // Verify board ownership
      if (!(await verifyBoardOwnership(db, body.boardId, user.id))) {
        set.status = 404;
        return errorResponse('Board not found');
      }

      // Update board's columnOrder
      await db
        .update(boards)
        .set({ columnOrder: body.columnOrder })
        .where(eq(boards.id, body.boardId));

      // Broadcast reorder update
      wsManager.broadcastToUser(user.id, {
        type: 'column-update',
        data: { boardId: body.boardId, columnId: '', action: 'reordered' }
      });

      return successResponse({ columnOrder: body.columnOrder }, 'Columns reordered');
    },
    {
      body: t.Object({
        boardId: t.String(),
        columnOrder: t.Array(t.String())
      })
    }
  );
