import { Elysia, t } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import { eq, and, gte, lte, or, sql, ilike, desc, asc, isNotNull } from 'drizzle-orm';
import {
  boards,
  columns,
  tasks,
  inboxItems,
  pomodoroSessions,
  habits,
  users,
  subtasks,
  reminders
} from '../../drizzle/schema';
import { commandProcessor } from '../mastra/agents/commandProcessor';
import { db } from './db';
import { wsManager } from './websocket';

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
          )
      )
      // COLUMNS
      .group('/columns', (column) =>
        column
          .get(
            '/:columnId',
            async ({ params, db, user }) => {
              const [column] = await db
                .select()
                .from(columns)
                .leftJoin(boards, eq(columns.boardId, boards.id))
                .where(and(eq(columns.id, params.columnId), eq(boards.userId, user.id)));

              if (!column) throw new Error('Column not found');
              return column;
            },
            {
              params: t.Object({ columnId: t.String() })
            }
          )
          .post(
            '/',
            async ({ body, db, user }) => {
              // Verify user owns the board
              const [board] = await db
                .select()
                .from(boards)
                .where(and(eq(boards.id, body.boardId), eq(boards.userId, user.id)));

              if (!board) throw new Error('Board not found');

              // Create the column
              const [newColumn] = await db
                .insert(columns)
                .values({
                  boardId: body.boardId,
                  name: body.name,
                  taskOrder: [],
                  position: body.position || 999,
                  wipLimit: body.wipLimit
                })
                .returning();

              // Update board's columnOrder
              const newColumnOrder = [...(board.columnOrder || []), newColumn.id];
              await db
                .update(boards)
                .set({ columnOrder: newColumnOrder })
                .where(eq(boards.id, body.boardId));

              // Broadcast update
              wsManager.broadcastColumnUpdate(body.boardId, newColumn.id, 'created');

              return newColumn;
            },
            {
              body: t.Object({
                boardId: t.String(),
                name: t.String(),
                position: t.Optional(t.Number()),
                wipLimit: t.Optional(t.Number())
              })
            }
          )
          .patch(
            '/:columnId',
            async ({ params, body, db, user }) => {
              // Verify user owns the board
              const [column] = await db
                .select()
                .from(columns)
                .leftJoin(boards, eq(columns.boardId, boards.id))
                .where(and(eq(columns.id, params.columnId), eq(boards.userId, user.id)));

              if (!column) throw new Error('Column not found');

              const [updated] = await db
                .update(columns)
                .set({
                  name: body.name || column.columns.name,
                  position: body.position !== undefined ? body.position : column.columns.position,
                  wipLimit: body.wipLimit !== undefined ? body.wipLimit : column.columns.wipLimit
                })
                .where(eq(columns.id, params.columnId))
                .returning();

              // Broadcast update
              wsManager.broadcastColumnUpdate(column.boards.id, params.columnId, 'updated');

              return updated;
            },
            {
              params: t.Object({ columnId: t.String() }),
              body: t.Object({
                name: t.Optional(t.String()),
                position: t.Optional(t.Number()),
                wipLimit: t.Optional(t.Union([t.Number(), t.Null()]))
              })
            }
          )
          .delete(
            '/:columnId',
            async ({ params, db, user }) => {
              // Verify user owns the board
              const [column] = await db
                .select()
                .from(columns)
                .leftJoin(boards, eq(columns.boardId, boards.id))
                .where(and(eq(columns.id, params.columnId), eq(boards.userId, user.id)));

              if (!column) throw new Error('Column not found');

              // Check if column has tasks
              const columnTasks = await db
                .select()
                .from(tasks)
                .where(eq(tasks.columnId, params.columnId))
                .limit(1);

              if (columnTasks.length > 0) {
                throw new Error('Cannot delete column with tasks');
              }

              // Remove from board's columnOrder
              const board = column.boards;
              if (board) {
                const newColumnOrder = (board.columnOrder || []).filter(
                  (id) => id !== params.columnId
                );
                await db
                  .update(boards)
                  .set({ columnOrder: newColumnOrder })
                  .where(eq(boards.id, board.id));
              }

              // Delete the column
              const [deleted] = await db
                .delete(columns)
                .where(eq(columns.id, params.columnId))
                .returning();

              // Broadcast update
              if (board) {
                wsManager.broadcastColumnUpdate(board.id, params.columnId, 'deleted');
              }

              return deleted;
            },
            {
              params: t.Object({ columnId: t.String() })
            }
          )
          .post(
            '/reorder',
            async ({ body, db, user }) => {
              // Verify user owns the board
              const [board] = await db
                .select()
                .from(boards)
                .where(and(eq(boards.id, body.boardId), eq(boards.userId, user.id)));

              if (!board) throw new Error('Board not found');

              // Update board's columnOrder
              await db
                .update(boards)
                .set({ columnOrder: body.columnOrder })
                .where(eq(boards.id, body.boardId));

              // Broadcast reorder update
              wsManager.broadcastColumnUpdate(body.boardId, '', 'reordered');

              return { success: true, columnOrder: body.columnOrder };
            },
            {
              body: t.Object({
                boardId: t.String(),
                columnOrder: t.Array(t.String())
              })
            }
          )
      )
      // TASKS
      .group('/tasks', (task) =>
        task
          .get(
            '/',
            async ({ query, db, user }) => {
              // Build where conditions
              const conditions = [eq(tasks.userId, user.id)];

              // Space filter
              if (query.space && query.space !== 'all') {
                conditions.push(eq(boards.space, query.space as 'work' | 'personal'));
              }

              // Search filter
              if (query.search) {
                conditions.push(
                  or(
                    ilike(tasks.title, `%${query.search}%`),
                    ilike(tasks.description, `%${query.search}%`)
                  )!
                );
              }

              // Priority filter
              if (query.priority) {
                conditions.push(eq(tasks.priority, query.priority));
              }

              // Label filter
              if (query.label) {
                conditions.push(
                  sql`${tasks.labels}::jsonb @> ${JSON.stringify([query.label])}::jsonb`
                );
              }

              // Due date filter
              if (query.dueBefore) {
                conditions.push(sql`${tasks.dueDate} <= ${new Date(query.dueBefore)}`);
              }
              if (query.dueAfter) {
                conditions.push(sql`${tasks.dueDate} >= ${new Date(query.dueAfter)}`);
              }

              // Build order by
              let orderByClause;
              switch (query.sortBy) {
                case 'priority':
                  orderByClause = [
                    sql`CASE
                      WHEN ${tasks.priority} = 'urgent' THEN 1
                      WHEN ${tasks.priority} = 'high' THEN 2
                      WHEN ${tasks.priority} = 'medium' THEN 3
                      WHEN ${tasks.priority} = 'low' THEN 4
                      ELSE 5
                    END`,
                    tasks.createdAt
                  ];
                  break;
                case 'dueDate':
                  orderByClause = [tasks.dueDate, tasks.createdAt];
                  break;
                case 'createdAt':
                  orderByClause =
                    query.sortOrder === 'asc' ? [asc(tasks.createdAt)] : [desc(tasks.createdAt)];
                  break;
                case 'updatedAt':
                default:
                  orderByClause =
                    query.sortOrder === 'asc' ? [asc(tasks.updatedAt)] : [desc(tasks.updatedAt)];
                  break;
              }

              const userTasks = await db
                .select({
                  id: tasks.id,
                  title: tasks.title,
                  description: tasks.description,
                  dueDate: tasks.dueDate,
                  priority: tasks.priority,
                  completed: tasks.completed,
                  columnId: tasks.columnId,
                  labels: tasks.labels,
                  recurringPattern: tasks.recurringPattern,
                  parentTaskId: tasks.parentTaskId,
                  createdAt: tasks.createdAt,
                  updatedAt: tasks.updatedAt,
                  columnName: columns.name,
                  boardName: boards.name,
                  boardId: boards.id,
                  boardSpace: boards.space
                })
                .from(tasks)
                .leftJoin(columns, eq(tasks.columnId, columns.id))
                .leftJoin(boards, eq(columns.boardId, boards.id))
                .where(and(...conditions))
                .orderBy(...orderByClause);

              return userTasks;
            },
            {
              query: t.Object({
                space: t.Optional(t.String()),
                search: t.Optional(t.String()),
                priority: t.Optional(t.String()),
                label: t.Optional(t.String()),
                dueBefore: t.Optional(t.String()),
                dueAfter: t.Optional(t.String()),
                sortBy: t.Optional(t.String()),
                sortOrder: t.Optional(t.String())
              })
            }
          )
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
                  priority: body.priority as 'low' | 'medium' | 'high' | 'urgent',
                  dueDate: body.dueDate ? new Date(body.dueDate) : null,
                  labels: body.labels || [],
                  recurringPattern: body.recurringPattern,
                  parentTaskId: body.parentTaskId
                })
                .returning();

              // Create reminder if due date is set
              if (body.dueDate && body.createReminder) {
                const reminderTime = new Date(body.dueDate);
                reminderTime.setHours(reminderTime.getHours() - 1); // Remind 1 hour before

                await db.insert(reminders).values({
                  userId: user.id,
                  taskId: newTask.id,
                  reminderTime,
                  message: `Task "${newTask.title}" is due soon`,
                  platform: 'discord' // Default platform, can be customized
                });
              }

              // Handle recurring task creation
              if (body.recurringPattern && body.dueDate) {
                // This would be handled by a cron job that checks for recurring tasks
                // and creates new instances when needed
              }

              // Broadcast task creation
              wsManager.broadcastTaskUpdate(newTask.id, newTask.columnId, 'created');

              return newTask;
            },
            {
              body: t.Object({
                columnId: t.String(),
                title: t.String(),
                description: t.Optional(t.String()),
                dueDate: t.Optional(t.String()),
                priority: t.Optional(t.String()),
                labels: t.Optional(t.Array(t.String())),
                recurringPattern: t.Optional(t.String()),
                parentTaskId: t.Optional(t.String()),
                createReminder: t.Optional(t.Boolean())
              })
            }
          )
          .patch(
            '/:id',
            async ({ params, body, db, user }) => {
              const updateData: Record<string, unknown> = {
                updatedAt: new Date()
              };

              // Handle specific field updates
              if (body.title !== undefined) updateData.title = body.title;
              if (body.description !== undefined) updateData.description = body.description;
              if (body.columnId !== undefined) updateData.columnId = body.columnId;
              if (body.priority !== undefined) updateData.priority = body.priority;
              if (body.completed !== undefined) updateData.completed = body.completed;
              if (body.labels !== undefined) updateData.labels = body.labels;
              if (body.recurringPattern !== undefined)
                updateData.recurringPattern = body.recurringPattern;
              if (body.dueDate !== undefined) {
                updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
              }

              const [updated] = await db
                .update(tasks)
                .set(updateData)
                .where(eq(tasks.id, params.id))
                .returning();

              // Update reminder if due date changed
              if (body.dueDate !== undefined && body.updateReminder) {
                // Delete existing reminder
                await db.delete(reminders).where(eq(reminders.taskId, params.id));

                // Create new reminder if due date is set
                if (body.dueDate) {
                  const reminderTime = new Date(body.dueDate);
                  reminderTime.setHours(reminderTime.getHours() - 1);

                  await db.insert(reminders).values({
                    userId: user.id,
                    taskId: params.id,
                    reminderTime,
                    message: `Task "${updated.title}" is due soon`,
                    platform: 'discord'
                  });
                }
              }

              // Broadcast task update
              wsManager.broadcastTaskUpdate(updated.id, updated.columnId, 'updated');

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
                completed: t.Optional(t.Boolean()),
                labels: t.Optional(t.Array(t.String())),
                recurringPattern: t.Optional(t.String()),
                updateReminder: t.Optional(t.Boolean())
              })
            }
          )
          .delete(
            '/:id',
            async ({ params, db }) => {
              const [deleted] = await db.delete(tasks).where(eq(tasks.id, params.id)).returning();

              // Broadcast task deletion
              wsManager.broadcastTaskUpdate(deleted.id, deleted.columnId, 'deleted');

              return deleted;
            },
            {
              params: t.Object({ id: t.String() })
            }
          )
          .post(
            '/reorder',
            async ({ body, db, user }) => {
              const { columnId, taskIds } = body;

              // Verify user owns the column
              const [column] = await db
                .select()
                .from(columns)
                .leftJoin(boards, eq(columns.boardId, boards.id))
                .where(and(eq(columns.id, columnId), eq(boards.userId, user.id)));

              if (!column) throw new Error('Column not found');

              // Update the column's task order
              await db.update(columns).set({ taskOrder: taskIds }).where(eq(columns.id, columnId));

              // Broadcast task reorder
              wsManager.broadcastTaskUpdate('', columnId, 'updated');

              return { success: true, taskOrder: taskIds };
            },
            {
              body: t.Object({
                columnId: t.String(),
                taskIds: t.Array(t.String())
              })
            }
          )
      )
      // SUBTASKS
      .group('/subtasks', (subtask) =>
        subtask
          .get(
            '/task/:taskId',
            async ({ params, db }) => {
              const taskSubtasks = await db
                .select()
                .from(subtasks)
                .where(eq(subtasks.taskId, params.taskId))
                .orderBy(subtasks.order);
              return taskSubtasks;
            },
            {
              params: t.Object({ taskId: t.String() })
            }
          )
          .post(
            '/',
            async ({ body, db }) => {
              // Get the highest order value for this task's subtasks
              const existingSubtasks = await db
                .select({ maxOrder: sql`MAX(${subtasks.order})` })
                .from(subtasks)
                .where(eq(subtasks.taskId, body.taskId));

              const nextOrder = ((existingSubtasks[0]?.maxOrder as number) || 0) + 1;

              const [newSubtask] = await db
                .insert(subtasks)
                .values({
                  taskId: body.taskId,
                  title: body.title,
                  completed: false,
                  order: nextOrder
                })
                .returning();

              // Broadcast subtask creation
              wsManager.broadcastSubtaskUpdate(body.taskId, newSubtask.id, 'created');

              return newSubtask;
            },
            {
              body: t.Object({
                taskId: t.String(),
                title: t.String()
              })
            }
          )
          .patch(
            '/:id',
            async ({ params, body, db }) => {
              const updateData: Record<string, unknown> = {
                updatedAt: new Date()
              };

              if (body.title !== undefined) updateData.title = body.title;
              if (body.completed !== undefined) updateData.completed = body.completed;
              if (body.order !== undefined) updateData.order = body.order;

              const [updated] = await db
                .update(subtasks)
                .set(updateData)
                .where(eq(subtasks.id, params.id))
                .returning();

              // Broadcast subtask update
              wsManager.broadcastSubtaskUpdate(updated.taskId, updated.id, 'updated');

              return updated;
            },
            {
              params: t.Object({ id: t.String() }),
              body: t.Object({
                title: t.Optional(t.String()),
                completed: t.Optional(t.Boolean()),
                order: t.Optional(t.Number())
              })
            }
          )
          .delete(
            '/:id',
            async ({ params, db }) => {
              const [deleted] = await db
                .delete(subtasks)
                .where(eq(subtasks.id, params.id))
                .returning();

              // Broadcast subtask deletion
              wsManager.broadcastSubtaskUpdate(deleted.taskId, deleted.id, 'deleted');

              return deleted;
            },
            {
              params: t.Object({ id: t.String() })
            }
          )
          .post(
            '/reorder',
            async ({ body, db }) => {
              const { taskId, subtaskIds } = body;

              // Update the order of each subtask
              const updatePromises = subtaskIds.map((id: string, index: number) =>
                db.update(subtasks).set({ order: index }).where(eq(subtasks.id, id))
              );

              await Promise.all(updatePromises);

              // Broadcast reorder
              wsManager.broadcastSubtaskUpdate(taskId, '', 'reordered');

              return { success: true };
            },
            {
              body: t.Object({
                taskId: t.String(),
                subtaskIds: t.Array(t.String())
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
                  userId: user.id,
                  space: body.space as 'work' | 'personal',
                  title: body.content,
                  content: body.content
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
              message: `Failed to process command: ${String(error)}`,
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
                  name: body.name,
                  space: 'work', // Default to work space for now
                  userId: user.id,
                  frequency: body.frequency as 'daily' | 'weekly' | 'monthly',
                  targetCount: body.targetCount || 1,
                  color: body.color || '#3b82f6'
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
      .get(
        '/calendar/events',
        async ({ query, db, user }) => {
          const { start, end, space } = query;

          // Parse dates
          const startDate = start ? new Date(start) : new Date();
          const endDate = end ? new Date(end) : new Date();

          // Build base conditions - user and has due date
          const conditions = [eq(tasks.userId, user.id), isNotNull(tasks.dueDate)];

          if (start) {
            conditions.push(gte(tasks.dueDate, startDate));
          }
          if (end) {
            conditions.push(lte(tasks.dueDate, endDate));
          }

          // Fetch all tasks with due dates, then filter by space in-memory
          const allEvents = await db
            .select({
              id: tasks.id,
              title: tasks.title,
              description: tasks.description,
              dueDate: tasks.dueDate,
              priority: tasks.priority,
              completed: tasks.completed,
              type: sql<string>`'task'`,
              space: boards.space
            })
            .from(tasks)
            .leftJoin(columns, eq(tasks.columnId, columns.id))
            .leftJoin(boards, eq(columns.boardId, boards.id))
            .where(and(...conditions))
            .orderBy(tasks.dueDate);

          // Filter by space if specified
          if (space && space !== 'all') {
            return allEvents.filter((event) => event.space === space);
          }

          return allEvents;
        },
        {
          query: t.Object({
            start: t.Optional(t.String()),
            end: t.Optional(t.String()),
            space: t.Optional(t.String())
          })
        }
      )
  );
