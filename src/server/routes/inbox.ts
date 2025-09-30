import { Elysia, t } from 'elysia';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { inboxItems } from '../../../drizzle/schema';

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
  );
