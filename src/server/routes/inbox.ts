import { Elysia, t } from 'elysia';
import { eq, and, desc } from 'drizzle-orm';
import { inboxItems, tasks, boards, columns } from '../../../drizzle/schema';
import { db } from '../db';

interface User {
  id: string;
  email: string;
}

export const inboxRoutes = new Elysia({ prefix: '/inbox' })
  .decorate('db', db)
  // Get all inbox items for a space
  .get(
    '/',
    async ({ query, db, user }) => {
      const items = await db
        .select()
        .from(inboxItems)
        .where(
          and(
            eq(inboxItems.userId, user.id),
            eq(inboxItems.space, query.space as 'work' | 'personal')
          )
        )
        .orderBy(desc(inboxItems.createdAt));

      return items;
    },
    {
      query: t.Object({
        space: t.String()
      })
    }
  )
  // Create a new inbox item
  .post(
    '/',
    async ({ body, db, user }) => {
      const [newItem] = await db
        .insert(inboxItems)
        .values({
          ...body,
          space: body.space as 'work' | 'personal',
          userId: user.id
        })
        .returning();

      return newItem;
    },
    {
      body: t.Object({
        title: t.String(),
        description: t.Optional(t.String()),
        space: t.String(),
        source: t.Optional(t.String())
      })
    }
  )
  // Move inbox items to a board
  .post(
    '/move',
    async ({ body, db, user }) => {
      const { itemIds, boardId } = body;

      // Get the board and its first column
      const board = await db.select().from(boards).where(eq(boards.id, boardId)).limit(1);
      if (!board.length) {
        throw new Error('Board not found');
      }

      const boardColumns = await db
        .select()
        .from(columns)
        .where(eq(columns.boardId, boardId))
        .orderBy(columns.position)
        .limit(1);

      if (!boardColumns.length) {
        throw new Error('Board has no columns');
      }

      const targetColumnId = boardColumns[0].id;

      // Get inbox items
      const items = await db
        .select()
        .from(inboxItems)
        .where(
          and(
            eq(inboxItems.userId, user.id),
            eq(inboxItems.processed, false)
            // In a real app, add: inClause(inboxItems.id, itemIds)
          )
        );

      // Create tasks from inbox items
      const newTasks = [];
      for (const item of items) {
        if (itemIds.includes(item.id)) {
          const [task] = await db
            .insert(tasks)
            .values({
              title: item.title,
              description: item.description || undefined,
              columnId: targetColumnId,
              userId: user.id
            })
            .returning();
          newTasks.push(task);

          // Mark inbox item as processed
          await db
            .update(inboxItems)
            .set({ processed: true, updatedAt: new Date() })
            .where(eq(inboxItems.id, item.id));
        }
      }

      return { success: true, tasksCreated: newTasks.length };
    },
    {
      body: t.Object({
        itemIds: t.Array(t.String()),
        boardId: t.String()
      })
    }
  )
  // Delete inbox items
  .post(
    '/delete',
    async ({ body, db, user }) => {
      const { itemIds } = body;

      // Delete items belonging to the user
      for (const itemId of itemIds) {
        await db
          .delete(inboxItems)
          .where(and(eq(inboxItems.id, itemId), eq(inboxItems.userId, user.id)));
      }

      return { success: true };
    },
    {
      body: t.Object({
        itemIds: t.Array(t.String())
      })
    }
  );
