import { Elysia, t } from 'elysia';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { boards, columns, tasks } from '../../../drizzle/schema';
import { withAuth } from '../auth/withAuth';
import { isColumnDone } from '../utils/taskCompletion';
import { wsManager } from '../websocket';
import { errorResponse, successResponse } from '../utils/errors';
import { verifyBoardOwnership } from '../utils/ownership';

export const boardRoutes = new Elysia({ prefix: '/boards' })
  .use(withAuth())
  .get(
    '/',
    async ({ query, db, user }) => {
      // Fetch boards with columns in a single query using JOIN
      const userBoards = await db
        .select({
          id: boards.id,
          userId: boards.userId,
          name: boards.name,
          space: boards.space,
          columnOrder: boards.columnOrder,
          createdAt: boards.createdAt,
          updatedAt: boards.updatedAt
        })
        .from(boards)
        .where(
          and(eq(boards.userId, user.id), eq(boards.space, query.space as 'work' | 'personal'))
        )
        .orderBy(desc(boards.updatedAt));

      // Fetch all columns for these boards in one query
      if (userBoards.length > 0) {
        const boardIds = userBoards.map((b) => b.id);
        const allColumns = await db
          .select()
          .from(columns)
          .where(inArray(columns.boardId, boardIds));

        // Group columns by board
        const columnsMap = new Map<string, unknown[]>();
        allColumns.forEach((col) => {
          if (!columnsMap.has(col.boardId)) {
            columnsMap.set(col.boardId, []);
          }
          columnsMap.get(col.boardId)!.push(col);
        });

        // Return boards with their columns
        return userBoards.map((board) => ({
          ...board,
          columns: columnsMap.get(board.id) || []
        }));
      }

      return userBoards;
    },
    {
      query: t.Object({ space: t.String() })
    }
  )
  .get(
    '/:boardId',
    async ({ params, db, user, set }) => {
      const [board] = await db
        .select()
        .from(boards)
        .where(and(eq(boards.id, params.boardId), eq(boards.userId, user.id)));

      if (!board) {
        set.status = 404;
        return { error: 'Board not found' };
      }

      const boardColumns = await db
        .select()
        .from(columns)
        .where(eq(columns.boardId, params.boardId));

      return { ...board, columns: boardColumns };
    },
    {
      params: t.Object({ boardId: t.String() })
    }
  )
  .post(
    '/',
    async ({ body, db, user }) => {
      // Use transaction for atomic board + columns creation
      const result = await db.transaction(async (tx) => {
        const [newBoard] = await tx
          .insert(boards)
          .values({
            ...body,
            space: body.space as 'work' | 'personal',
            userId: user.id
          })
          .returning();

        const defaultColumns = ['To Do', 'In Progress', 'Done'];
        const newColumns = await tx
          .insert(columns)
          .values(
            defaultColumns.map((name) => ({
              boardId: newBoard.id,
              name,
              taskOrder: []
            }))
          )
          .returning();

        await tx
          .update(boards)
          .set({ columnOrder: newColumns.map((col) => col.id) })
          .where(eq(boards.id, newBoard.id));

        return { ...newBoard, columns: newColumns };
      });

      // Broadcast board creation
      wsManager.broadcastToUser(user.id, {
        type: 'board-update',
        data: { boardId: result.id, action: 'created' }
      });

      return successResponse(result, 'Board created');
    },
    {
      body: t.Object({
        name: t.String(),
        space: t.String()
      })
    }
  )
  .patch(
    '/:boardId',
    async ({ params, body, db, user, set }) => {
      // Verify ownership
      if (!(await verifyBoardOwnership(db, params.boardId, user.id))) {
        set.status = 404;
        return errorResponse('Board not found');
      }

      const [updated] = await db
        .update(boards)
        .set({
          name: body.name,
          updatedAt: new Date()
        })
        .where(eq(boards.id, params.boardId))
        .returning();

      // Broadcast board update
      wsManager.broadcastToUser(user.id, {
        type: 'board-update',
        data: { boardId: updated.id, action: 'updated' }
      });

      return successResponse(updated, 'Board updated');
    },
    {
      params: t.Object({ boardId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String())
      })
    }
  )
  .delete(
    '/:boardId',
    async ({ params, db, user, set }) => {
      // Verify ownership
      if (!(await verifyBoardOwnership(db, params.boardId, user.id))) {
        set.status = 404;
        return errorResponse('Board not found');
      }

      // Use transaction for atomic deletion
      const deleted = await db.transaction(async (tx) => {
        // Delete all columns (cascade will handle tasks)
        await tx.delete(columns).where(eq(columns.boardId, params.boardId));

        // Delete the board
        const [result] = await tx.delete(boards).where(eq(boards.id, params.boardId)).returning();
        return result;
      });

      // Broadcast board deletion
      wsManager.broadcastToUser(user.id, {
        type: 'board-update',
        data: { boardId: deleted.id, action: 'deleted' }
      });

      return successResponse(deleted, 'Board deleted');
    },
    {
      params: t.Object({ boardId: t.String() })
    }
  )
  .get(
    '/:boardId/summary',
    async ({ params, query, db, user, set }) => {
      // Fetch board
      const [board] = await db
        .select()
        .from(boards)
        .where(and(eq(boards.id, params.boardId), eq(boards.userId, user.id)));

      if (!board) {
        set.status = 404;
        return { error: 'Board not found' };
      }

      // Fetch columns
      const boardColumns = await db
        .select()
        .from(columns)
        .where(eq(columns.boardId, params.boardId));

      // Fetch tasks for the board (or specific column if specified) with column names
      let boardTasks: Array<typeof tasks.$inferSelect & { columnName?: string | null }>;
      if (query.columnId) {
        const tasksWithColumns = await db
          .select({
            task: tasks,
            columnName: columns.name
          })
          .from(tasks)
          .leftJoin(columns, eq(tasks.columnId, columns.id))
          .where(eq(tasks.columnId, query.columnId));
        boardTasks = tasksWithColumns.map((t) => ({ ...t.task, columnName: t.columnName ?? null }));
      } else {
        const columnIds = boardColumns.map((c) => c.id);
        if (columnIds.length > 0) {
          const tasksWithColumns = await db
            .select({
              task: tasks,
              columnName: columns.name
            })
            .from(tasks)
            .leftJoin(columns, eq(tasks.columnId, columns.id))
            .where(inArray(tasks.columnId, columnIds));
          boardTasks = tasksWithColumns.map((t) => ({
            ...t.task,
            columnName: t.columnName ?? null
          }));
        } else {
          boardTasks = [];
        }
      }

      // Generate text summary
      let summary = '';

      if (query.columnId) {
        const column = boardColumns.find((c) => c.id === query.columnId);
        if (!column) {
          set.status = 404;
          return { error: 'Column not found' };
        }
        summary += `# ${board.name} - ${column.name}\n\n`;
      } else {
        summary += `# ${board.name}\n\n`;
      }

      const totalTasks = boardTasks.length;
      const completedTasks = boardTasks.filter(
        (t) => t.columnName && isColumnDone(t.columnName)
      ).length;
      const incompleteTasks = totalTasks - completedTasks;

      summary += `**Overview:**\n`;
      summary += `- Total tasks: ${totalTasks}\n`;
      summary += `- Completed: ${completedTasks}\n`;
      summary += `- Incomplete: ${incompleteTasks}\n\n`;

      // Group by column
      if (!query.columnId) {
        summary += `**Tasks by Column:**\n\n`;
        for (const column of boardColumns) {
          const columnTasks = boardTasks.filter((t) => t.columnId === column.id);
          if (columnTasks.length > 0) {
            summary += `### ${column.name} (${columnTasks.length})\n`;
            for (const task of columnTasks) {
              const status = task.columnName && isColumnDone(task.columnName) ? '[x]' : '[ ]';
              const priority = task.priority ? ` [${task.priority}]` : '';
              const dueDate = task.dueDate
                ? ` (Due: ${new Date(task.dueDate).toLocaleDateString()})`
                : '';
              summary += `${status} ${task.title}${priority}${dueDate}\n`;
            }
            summary += '\n';
          }
        }
      } else {
        summary += `**Tasks:**\n\n`;
        for (const task of boardTasks) {
          const status = task.columnName && isColumnDone(task.columnName) ? '[x]' : '[ ]';
          const priority = task.priority ? ` [${task.priority}]` : '';
          const dueDate = task.dueDate
            ? ` (Due: ${new Date(task.dueDate).toLocaleDateString()})`
            : '';
          summary += `${status} ${task.title}${priority}${dueDate}\n`;
        }
      }

      return {
        boardId: board.id,
        boardName: board.name,
        columnId: query.columnId || null,
        summary
      };
    },
    {
      params: t.Object({ boardId: t.String() }),
      query: t.Object({
        columnId: t.Optional(t.String())
      })
    }
  );
