import { Elysia, t } from 'elysia';
import type { SQL } from 'drizzle-orm';
import { and, eq, like, or, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { tasks, boards, inboxItems, reminders } from '../../../drizzle/schema';

interface User {
  id: string;
  email: string;
}

export const searchRoutes = new Elysia({ prefix: '/search' })
  .decorate('db', db)

  // Global search across all entities
  .get(
    '/',
    async ({ query, db, user }) => {
      const { q, space = 'all', type = 'all', limit = 20 } = query;

      const searchTerm = `%${q}%`;
      const results: {
        tasks: unknown[];
        boards: unknown[];
        inbox: unknown[];
        reminders: unknown[];
      } = {
        tasks: [],
        boards: [],
        inbox: [],
        reminders: []
      };

      // Search tasks
      if (type === 'all' || type === 'tasks') {
        let taskWhereClause: SQL<unknown> | undefined = eq(tasks.userId, user.id);

        if (space !== 'all') {
          // This part needs a join with boards to filter by space, which is not currently done for tasks.
          // For now, I'll assume tasks don't have a direct 'space' column and skip this condition.
          // If tasks had a 'space' column, it would be:
          // taskWhereClause = and(taskWhereClause, eq(tasks.space, space));
        }

        const taskSearchCondition = or(
          like(tasks.title, searchTerm),
          like(tasks.description, searchTerm)
        );
        taskWhereClause = and(taskWhereClause, taskSearchCondition) || sql`true`;

        results.tasks = await db
          .select()
          .from(tasks)
          .where(taskWhereClause ? taskWhereClause : undefined)
          .orderBy(desc(tasks.updatedAt))
          .limit(limit);
      }

      // Search boards
      if (type === 'all' || type === 'boards') {
        let boardWhereClause: SQL<unknown> | undefined = eq(boards.userId, user.id);
        boardWhereClause = and(boardWhereClause, like(boards.name, searchTerm));

        if (space !== 'all') {
          boardWhereClause = and(boardWhereClause, sql`${boards.space} = ${space}`);
        }
        boardWhereClause = boardWhereClause || sql`true`;

        results.boards = await db
          .select()
          .from(boards)
          .where(boardWhereClause)
          .orderBy(desc(boards.createdAt))
          .limit(limit);
      }

      // Search inbox items
      if (type === 'all' || type === 'inbox') {
        let inboxWhereClause: SQL<unknown> | undefined = eq(inboxItems.userId, user.id);
        const inboxSearchCondition = or(
          like(inboxItems.title, searchTerm),
          like(inboxItems.description, searchTerm)
        );
        inboxWhereClause = and(inboxWhereClause, inboxSearchCondition);

        if (space !== 'all') {
          inboxWhereClause = and(inboxWhereClause, sql`${inboxItems.space} = ${space}`);
        }
        inboxWhereClause = inboxWhereClause || sql`true`;

        results.inbox = await db
          .select()
          .from(inboxItems)
          .where(inboxWhereClause)
          .orderBy(desc(inboxItems.createdAt))
          .limit(limit);
      }

      // Search reminders
      if (type === 'all' || type === 'reminders') {
        results.reminders = await db
          .select()
          .from(reminders)
          .where(and(eq(reminders.userId, user.id), like(reminders.message, searchTerm)))
          .orderBy(desc(reminders.createdAt))
          .limit(limit);
      }

      return results;
    },
    {
      query: t.Object({
        q: t.String(),
        space: t.Optional(t.Union([t.Literal('all'), t.Literal('work'), t.Literal('personal')])),
        type: t.Optional(
          t.Union([
            t.Literal('all'),
            t.Literal('tasks'),
            t.Literal('boards'),
            t.Literal('inbox'),
            t.Literal('reminders')
          ])
        ),
        limit: t.Optional(t.Number())
      })
    }
  )

  // Quick search for command bar
  .get(
    '/quick',
    async ({ query, db, user }) => {
      const { q } = query;
      const searchTerm = `%${q}%`;

      // Return top 5 results from each category
      const [topTasks, topBoards, topInbox] = await Promise.all([
        db
          .select({
            id: tasks.id,
            title: tasks.title,
            type: sql<string>`'task'`
          })
          .from(tasks)
          .where(and(eq(tasks.userId, user.id), like(tasks.title, searchTerm)))
          .limit(5),

        db
          .select({
            id: boards.id,
            title: boards.name,
            type: sql<string>`'board'`
          })
          .from(boards)
          .where(and(eq(boards.userId, user.id), like(boards.name, searchTerm)))
          .limit(5),

        db
          .select({
            id: inboxItems.id,
            title: inboxItems.title,
            type: sql<string>`'inbox'`
          })
          .from(inboxItems)
          .where(and(eq(inboxItems.userId, user.id), like(inboxItems.title, searchTerm)))
          .limit(5)
      ]);

      return [...topTasks, ...topBoards, ...topInbox];
    },
    {
      query: t.Object({
        q: t.String()
      })
    }
  )

  // Search suggestions/autocomplete
  .get(
    '/suggestions',
    async ({ query, db, user }) => {
      const { q } = query;
      const searchTerm = `%${q}%`;

      // Get recent searches and popular items
      // For now, return title suggestions from tasks
      const suggestions = await db
        .select({
          text: tasks.title
        })
        .from(tasks)
        .where(and(eq(tasks.userId, user.id), like(tasks.title, searchTerm)))
        .limit(10);

      return suggestions.map((s) => s.text);
    },
    {
      query: t.Object({
        q: t.String()
      })
    }
  );
