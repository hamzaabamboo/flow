import { Elysia, t } from 'elysia';
import { eq, and, inArray } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { inboxItems, tasks } from '../../../drizzle/schema';

export const inboxRoutes = new Elysia({ prefix: '/inbox' })
  .use(withAuth())
  .get(
    '/',
    async ({ query, db, user }) => {
      const items = await db
        .select()
        .from(inboxItems)
        .where(
          and(
            eq(inboxItems.userId, user.id),
            eq(inboxItems.space, query.space as 'work' | 'personal'),
            eq(inboxItems.processed, false)
          )
        )
        .orderBy(inboxItems.createdAt);
      return items;
    },
    {
      query: t.Object({ space: t.String() })
    }
  )
  .post(
    '/',
    async ({ body, db, user }) => {
      const [newItem] = await db
        .insert(inboxItems)
        .values({
          userId: user.id,
          space: body.space as 'work' | 'personal',
          title: body.content,
          description: body.content
        })
        .returning();
      return newItem;
    },
    {
      body: t.Object({
        content: t.String(),
        space: t.String()
      })
    }
  )
  // Convert inbox item to task
  .post(
    '/convert',
    async ({ body, db, user }) => {
      const { itemId, columnId } = body;

      // Get inbox item
      const [item] = await db
        .select()
        .from(inboxItems)
        .where(and(eq(inboxItems.id, itemId), eq(inboxItems.userId, user.id)));

      if (!item) {
        throw new Error('Inbox item not found');
      }

      // Create task
      const [task] = await db
        .insert(tasks)
        .values({
          columnId,
          title: item.title,
          description: item.description || null,
          userId: user.id
        })
        .returning();

      // Mark inbox item as processed
      await db.update(inboxItems).set({ processed: true }).where(eq(inboxItems.id, itemId));

      return task;
    },
    {
      body: t.Object({
        itemId: t.String(),
        columnId: t.String()
      })
    }
  )
  // Delete inbox items
  .post(
    '/delete',
    async ({ body, db, user }) => {
      const { itemIds } = body;

      await db
        .delete(inboxItems)
        .where(and(inArray(inboxItems.id, itemIds), eq(inboxItems.userId, user.id)));

      return { success: true };
    },
    {
      body: t.Object({
        itemIds: t.Array(t.String())
      })
    }
  );
