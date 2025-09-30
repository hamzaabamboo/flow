import { Elysia, t } from 'elysia';
import { eq, and } from 'drizzle-orm';
import { boards, columns } from '../../../drizzle/schema';
import { withAuth } from '../auth/withAuth';

export const boardRoutes = new Elysia({ prefix: '/boards' })
  .use(withAuth())
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
      query: t.Object({ space: t.String() })
    }
  )
  .get(
    '/:boardId',
    async ({ params, db, user }) => {
      const [board] = await db
        .select()
        .from(boards)
        .where(and(eq(boards.id, params.boardId), eq(boards.userId, user.id)));

      if (!board) throw new Error('Board not found');

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
      const [newBoard] = await db
        .insert(boards)
        .values({
          ...body,
          space: body.space as 'work' | 'personal',
          userId: user.id
        })
        .returning();

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

      await db
        .update(boards)
        .set({ columnOrder: newColumns.map((col) => col.id) })
        .where(eq(boards.id, newBoard.id));

      return { ...newBoard, columns: newColumns };
    },
    {
      body: t.Object({
        name: t.String(),
        space: t.String()
      })
    }
  );
