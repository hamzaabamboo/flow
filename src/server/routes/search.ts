import { Elysia, t } from 'elysia';
import { eq, and, or, sql } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { tasks, boards } from '../../../drizzle/schema';

export const searchRoutes = new Elysia({ prefix: '/search' }).use(withAuth()).get(
  '/',
  async ({ query, db, user }) => {
    const { q, space = 'all', type = 'all', limit = 20 } = query;
    const searchTerm = `%${q}%`;
    const results: unknown[] = [];

    // Search tasks
    if (type === 'all' || type === 'tasks') {
      const taskResults = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          type: sql<string>`'task'`
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, user.id),
            or(
              sql`${tasks.title} ILIKE ${searchTerm}`,
              sql`${tasks.description} ILIKE ${searchTerm}`
            )
          )
        )
        .limit(Number(limit));
      results.push(...taskResults);
    }

    // Search boards
    if (type === 'all' || type === 'boards') {
      const boardResults = await db
        .select({
          id: boards.id,
          name: boards.name,
          space: boards.space,
          type: sql<string>`'board'`
        })
        .from(boards)
        .where(
          and(
            eq(boards.userId, user.id),
            space !== 'all' ? eq(boards.space, space as 'work' | 'personal') : undefined,
            sql`${boards.name} ILIKE ${searchTerm}`
          )
        )
        .limit(Number(limit));
      results.push(...boardResults);
    }

    return { results, query: q, total: results.length };
  },
  {
    query: t.Object({
      q: t.String(),
      space: t.Optional(t.String()),
      type: t.Optional(t.String()),
      limit: t.Optional(t.String())
    })
  }
);
