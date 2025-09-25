import { Elysia, t } from 'elysia';
import { eq, and } from 'drizzle-orm';
import { boards, columns } from '../../../drizzle/schema';
import { db } from '../db';

export const boardRoutes = new Elysia({ prefix: '/boards' })
  .decorate('db', db)
  // Get all boards for a user in a space
  .get(
    '/',
    async ({ query, db, user }) => {
      const userBoards = await db
        .select()
        .from(boards)
        .where(
          and(eq(boards.userId, user.id), eq(boards.space, query.space as 'work' | 'personal'))
        );

      return userBoards;
    },
    {
      query: t.Object({
        space: t.String()
      })
    }
  )
  // Get a single board with columns
  .get(
    '/:boardId',
    async ({ params, db }) => {
      const [board] = await db.select().from(boards).where(eq(boards.id, params.boardId));

      if (!board) {
        throw new Error('Board not found');
      }

      const boardColumns = await db
        .select()
        .from(columns)
        .where(eq(columns.boardId, params.boardId));

      return {
        ...board,
        columns: boardColumns
      };
    },
    {
      params: t.Object({
        boardId: t.String()
      })
    }
  )
  // Create a new board
  .post(
    '/',
    async ({ body, db, user }) => {
      const [newBoard] = await db
        .insert(boards)
        .values({
          ...body,
          space: body.space as 'work' | 'personal',
          userId: user.id // Use authenticated user's ID
        })
        .returning();

      // Create default columns
      const defaultColumns = ['To Do', 'In Progress', 'Done'];
      const newColumns = await db
        .insert(columns)
        .values(
          defaultColumns.map((name) => ({
            boardId: newBoard.id,
            name,
            taskOrder: []
          }))
        )
        .returning();

      // Update board with column order
      await db
        .update(boards)
        .set({
          columnOrder: newColumns.map((col: { id: string }) => col.id)
        })
        .where(eq(boards.id, newBoard.id));

      return {
        ...newBoard,
        columns: newColumns
      };
    },
    {
      body: t.Object({
        name: t.String(),
        space: t.String()
      })
    }
  )
  // Update a board
  .patch(
    '/:boardId',
    async ({ params, body, db }) => {
      const [updatedBoard] = await db
        .update(boards)
        .set({
          ...body,
          updatedAt: new Date()
        })
        .where(eq(boards.id, params.boardId))
        .returning();

      return updatedBoard;
    },
    {
      params: t.Object({
        boardId: t.String()
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        columnOrder: t.Optional(t.Array(t.String()))
      })
    }
  )
  // Delete a board
  .delete(
    '/:boardId',
    async ({ params, db }) => {
      await db.delete(boards).where(eq(boards.id, params.boardId));

      return { success: true };
    },
    {
      params: t.Object({
        boardId: t.String()
      })
    }
  );
