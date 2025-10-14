import { Elysia, t } from 'elysia';
import { eq, and, inArray } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { inboxItems, tasks } from '../../../drizzle/schema';
import { wsManager } from '../websocket';
import { successResponse } from '../utils/errors';

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

      // Broadcast inbox update
      wsManager.broadcastToUser(user.id, {
        type: 'inbox-update',
        data: { userId: user.id, space: body.space }
      });

      return successResponse(newItem, 'Item added to inbox');
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

      // Use transaction for atomic conversion
      const result = await db.transaction(async (tx) => {
        // Get inbox item
        const [item] = await tx
          .select()
          .from(inboxItems)
          .where(and(eq(inboxItems.id, itemId), eq(inboxItems.userId, user.id)));

        if (!item) {
          throw new Error('Inbox item not found');
        }

        // Create task
        const [task] = await tx
          .insert(tasks)
          .values({
            columnId,
            title: item.title,
            description: item.description || null,
            userId: user.id
          })
          .returning();

        // Mark inbox item as processed
        await tx.update(inboxItems).set({ processed: true }).where(eq(inboxItems.id, itemId));

        return { task, space: item.space };
      });

      // Broadcast inbox update
      wsManager.broadcastToUser(user.id, {
        type: 'inbox-update',
        data: { userId: user.id, space: result.space }
      });

      return successResponse(result.task, 'Converted to task');
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

      // Get items before deletion to know which space to broadcast
      const itemsToDelete = await db
        .select()
        .from(inboxItems)
        .where(and(inArray(inboxItems.id, itemIds), eq(inboxItems.userId, user.id)));

      await db
        .delete(inboxItems)
        .where(and(inArray(inboxItems.id, itemIds), eq(inboxItems.userId, user.id)));

      // Broadcast inbox updates for each affected space
      const affectedSpaces = new Set(itemsToDelete.map((item) => item.space));
      for (const space of affectedSpaces) {
        wsManager.broadcastToUser(user.id, {
          type: 'inbox-update',
          data: { userId: user.id, space }
        });
      }

      return successResponse(null, `Deleted ${itemIds.length} items`);
    },
    {
      body: t.Object({
        itemIds: t.Array(t.String())
      })
    }
  );
