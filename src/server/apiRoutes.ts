import { Elysia, t } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import { eq, and, gte, or, sql } from 'drizzle-orm';
import {
  boards,
  columns,
  tasks,
  inboxItems,
  pomodoroSessions,
  habits,
  users
} from '../../drizzle/schema';
import { commandProcessor } from '../mastra/agents/commandProcessor';
import { db } from './db';

export const apiRoutes = new Elysia()
  .decorate('db', db)
  .use(cookie())
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'your-secret-key'
    })
  )
  .group('/api', (app) =>
    app
      .derive(async ({ cookie, jwt, db, set }) => {
        const token = cookie.auth?.value;

        if (!token) {
          set.status = 401;
          throw new Error('Authentication required');
        }

        try {
          const payload = await jwt.verify(token as string);

          if (!payload || !payload.userId) {
            set.status = 401;
            throw new Error('Invalid token');
          }

          // Get user from database
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, payload.userId as string));

          if (!user) {
            set.status = 401;
            throw new Error('User not found');
          }

          return {
            user: {
              id: user.id,
              email: user.email,
              name: user.name
            }
          };
        } catch (_error) {
          set.status = 401;
          throw new Error('Authentication failed');
        }
      })
      // BOARDS
      .group('/boards', (board) =>
        board
          .get(
            '/',
            async ({ query, db, user }) => {
              const userBoards = await db
                .select()
                .from(boards)
                .where(
                  and(
                    eq(boards.userId, user.id),
                    eq(boards.space, query.space as 'work' | 'personal')
                  )
                );
              return userBoards;
            },
            {
              query: t.Object({ space: t.String() })
            }
          )
          .get(
            '/:boardId',
            async ({ params, db }) => {
              const [board] = await db.select().from(boards).where(eq(boards.id, params.boardId));
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
          )
      )
      // TASKS
      .group('/tasks', (task) =>
        task
          .get(
            '/:columnId',
            async ({ params, db }) => {
              const columnTasks = await db
                .select()
                .from(tasks)
                .where(eq(tasks.columnId, params.columnId));
              return columnTasks;
            },
            {
              params: t.Object({ columnId: t.String() })
            }
          )
          .post(
            '/',
            async ({ body, db, user }) => {
              const [newTask] = await db
                .insert(tasks)
                .values({
                  ...body,
                  userId: user.id,
                  priority: body.priority as 'low' | 'medium' | 'high' | 'urgent'
                })
                .returning();
              return newTask;
            },
            {
              body: t.Object({
                columnId: t.String(),
                title: t.String(),
                description: t.Optional(t.String()),
                dueDate: t.Optional(t.String()),
                priority: t.Optional(t.String())
              })
            }
          )
          .patch(
            '/:id',
            async ({ params, body, db }) => {
              const [updated] = await db
                .update(tasks)
                .set({ ...body, updatedAt: new Date() })
                .where(eq(tasks.id, params.id))
                .returning();
              return updated;
            },
            {
              params: t.Object({ id: t.String() }),
              body: t.Object({
                columnId: t.Optional(t.String()),
                title: t.Optional(t.String()),
                description: t.Optional(t.String()),
                dueDate: t.Optional(t.String()),
                priority: t.Optional(t.String()),
                completed: t.Optional(t.Boolean())
              })
            }
          )
      )
      // INBOX
      .group('/inbox', (inbox) =>
        inbox
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
                  ...body,
                  userId: user.id,
                  space: body.space as 'work' | 'personal'
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
      )
      // POMODORO
      .group('/pomodoro', (pomo) =>
        pomo
          .get('/', async ({ db, user }) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const sessions = await db
              .select()
              .from(pomodoroSessions)
              .where(
                and(eq(pomodoroSessions.userId, user.id), gte(pomodoroSessions.startTime, today))
              );
            return sessions;
          })
          .post(
            '/',
            async ({ body, db, user }) => {
              const [session] = await db
                .insert(pomodoroSessions)
                .values({
                  ...body,
                  userId: user.id,
                  startTime: new Date(body.startTime)
                })
                .returning();
              return session;
            },
            {
              body: t.Object({
                taskId: t.Optional(t.String()),
                duration: t.Number(),
                startTime: t.String()
              })
            }
          )
      )
      // COMMAND
      .post(
        '/command',
        async ({ body, db, user }) => {
          const { command, space } = body;

          try {
            const result = await commandProcessor.generate([
              {
                role: 'user',
                content: `Process this command for user ${user.id} in ${space} space: ${command}`
              }
            ]);

            return {
              success: true,
              message: result.text || 'Command processed',
              data: result
            };
          } catch (error) {
            return {
              success: false,
              message: `Failed to process command: ${error}`,
              data: null
            };
          }
        },
        {
          body: t.Object({
            command: t.String(),
            space: t.String()
          })
        }
      )
      // SEARCH
      .get(
        '/search',
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
      )
      // SETTINGS
      .get('/settings', () => ({
        theme: 'light',
        defaultSpace: 'work',
        pomodoroLength: 25,
        breakLength: 5,
        longBreakLength: 15,
        autoStartBreaks: false,
        notifications: true
      }))
      // HABITS
      .group('/habits', (habit) =>
        habit
          .get('/', async ({ db, user }) => {
            const userHabits = await db
              .select()
              .from(habits)
              .where(eq(habits.userId, user.id))
              .orderBy(habits.name);
            return userHabits;
          })
          .post(
            '/',
            async ({ body, db, user }) => {
              const [newHabit] = await db
                .insert(habits)
                .values({
                  ...body,
                  userId: user.id,
                  frequency: body.frequency as 'daily' | 'weekly' | 'monthly'
                })
                .returning();
              return newHabit;
            },
            {
              body: t.Object({
                name: t.String(),
                frequency: t.String(),
                targetCount: t.Optional(t.Number()),
                color: t.Optional(t.String())
              })
            }
          )
      )
      // CALENDAR
      .get('/calendar/feed-url', ({ user }) => {
        const token = Buffer.from(`${user.id}:calendar`).toString('base64');
        const baseUrl = process.env.API_URL || `http://localhost:3000`;
        return { url: `${baseUrl}/calendar/ical/${token}` };
      })
  );
