import { Elysia, t } from 'elysia';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { boards, columns, tasks } from '../../../drizzle/schema';
import { wsManager } from '../websocket';

export const columnsRoutes = new Elysia({ prefix: '/columns' })
  .use(withAuth())
  .get(
    '/:columnId',
    async ({ params, db, user }) => {
      const [column] = await db
        .select()
        .from(columns)
        .leftJoin(boards, eq(columns.boardId, boards.id))
        .where(and(eq(columns.id, params.columnId), eq(boards.userId, user.id)));

      if (!column) throw new Error('Column not found');
      return column;
    },
    {
      params: t.Object({ columnId: t.String() })
    }
  )
  .post(
    '/',
    async ({ body, db, user }) => {
      // Verify user owns the board
      const [board] = await db
        .select()
        .from(boards)
        .where(and(eq(boards.id, body.boardId), eq(boards.userId, user.id)));

      if (!board) throw new Error('Board not found');

      // Create the column
      const [newColumn] = await db
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
      await db
        .update(boards)
        .set({ columnOrder: newColumnOrder })
        .where(eq(boards.id, body.boardId));

      // Broadcast update
      wsManager.broadcastColumnUpdate(body.boardId, newColumn.id, 'created');

      return newColumn;
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
    async ({ params, body, db, user }) => {
      // Verify user owns the board
      const [column] = await db
        .select()
        .from(columns)
        .leftJoin(boards, eq(columns.boardId, boards.id))
        .where(and(eq(columns.id, params.columnId), eq(boards.userId, user.id)));

      if (!column) throw new Error('Column not found');

      const [updated] = await db
        .update(columns)
        .set({
          name: body.name || column.columns.name,
          position: body.position !== undefined ? body.position : column.columns.position,
          wipLimit: body.wipLimit !== undefined ? body.wipLimit : column.columns.wipLimit
        })
        .where(eq(columns.id, params.columnId))
        .returning();

      // Broadcast update
      wsManager.broadcastColumnUpdate(column.boards?.id || '', params.columnId, 'updated');

      return updated;
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
    async ({ params, db, user }) => {
      // Verify user owns the board
      const [column] = await db
        .select()
        .from(columns)
        .leftJoin(boards, eq(columns.boardId, boards.id))
        .where(and(eq(columns.id, params.columnId), eq(boards.userId, user.id)));

      if (!column) throw new Error('Column not found');

      // Check if column has tasks
      const columnTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.columnId, params.columnId))
        .limit(1);

      if (columnTasks.length > 0) {
        throw new Error('Cannot delete column with tasks');
      }

      // Remove from board's columnOrder
      const board = column.boards;
      if (board) {
        const newColumnOrder = ((board.columnOrder as string[]) || []).filter(
          (id: string) => id !== params.columnId
        );
        await db.update(boards).set({ columnOrder: newColumnOrder }).where(eq(boards.id, board.id));
      }

      // Delete the column
      const [deleted] = await db.delete(columns).where(eq(columns.id, params.columnId)).returning();

      // Broadcast update
      if (board) {
        wsManager.broadcastColumnUpdate(board.id, params.columnId, 'deleted');
      }

      return deleted;
    },
    {
      params: t.Object({ columnId: t.String() })
    }
  )
  .post(
    '/reorder',
    async ({ body, db, user }) => {
      // Verify user owns the board
      const [board] = await db
        .select()
        .from(boards)
        .where(and(eq(boards.id, body.boardId), eq(boards.userId, user.id)));

      if (!board) throw new Error('Board not found');

      // Update board's columnOrder
      await db
        .update(boards)
        .set({ columnOrder: body.columnOrder })
        .where(eq(boards.id, body.boardId));

      // Broadcast reorder update
      wsManager.broadcastColumnUpdate(body.boardId, '', 'reordered');

      return { success: true, columnOrder: body.columnOrder };
    },
    {
      body: t.Object({
        boardId: t.String(),
        columnOrder: t.Array(t.String())
      })
    }
  );
