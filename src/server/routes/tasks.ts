import { Elysia, t } from 'elysia';
import { eq, and, or, sql, ilike, desc, asc } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import {
  boards,
  columns,
  tasks,
  subtasks,
  taskCompletions,
  pomodoroSessions,
  pomodoroActiveState
} from '../../../drizzle/schema';
import { wsManager } from '../websocket';
import { ReminderSyncService } from '../services/reminder-sync';
import { getTaskCompletionState, resolveCompletionColumnId } from '../utils/taskCompletion';
import { nowInJst, getJstDateComponents } from '../../shared/utils/timezone';

function getTodayJstDateString() {
  const now = nowInJst();
  const { year, month, day } = getJstDateComponents(now);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeCompletionDate(instanceDate?: string) {
  if (!instanceDate) return getTodayJstDateString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(instanceDate)) return instanceDate;

  const parsed = new Date(instanceDate);
  if (Number.isNaN(parsed.getTime())) {
    return getTodayJstDateString();
  }

  const { year, month, day } = getJstDateComponents(parsed);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function withCompletionState<T extends { columnName?: string | null; completed?: boolean | null }>(
  task: T
) {
  const completed = getTaskCompletionState(task);
  return {
    ...task,
    completed,
    completionState: completed ? 'completed' : 'active'
  };
}

export const tasksRoutes = new Elysia({ prefix: '/tasks' })
  .use(withAuth())
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
        conditions.push(sql`${tasks.labels}::jsonb @> ${JSON.stringify([query.label])}::jsonb`);
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

      const userTasksRaw = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          dueDate: tasks.dueDate,
          priority: tasks.priority,
          columnId: tasks.columnId,
          labels: tasks.labels,
          recurringPattern: tasks.recurringPattern,
          parentTaskId: tasks.parentTaskId,
          metadata: tasks.metadata,
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

      const userTasks = userTasksRaw.map((task) =>
        withCompletionState({
          ...task,
          link: task.metadata?.link
        })
      );

      if (query.completed === 'true' || query.completed === 'false') {
        const completed = query.completed === 'true';
        return userTasks.filter((task) => task.completed === completed);
      }

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
        completed: t.Optional(t.String()),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.String())
      })
    }
  )
  .get(
    '/column/:id',
    async ({ params, db, user }) => {
      const columnTasks = await db
        .select({
          task: tasks,
          columnName: columns.name
        })
        .from(tasks)
        .leftJoin(columns, eq(tasks.columnId, columns.id))
        .leftJoin(boards, eq(columns.boardId, boards.id))
        .where(
          and(eq(tasks.columnId, params.id), eq(tasks.userId, user.id), eq(boards.userId, user.id))
        );

      return columnTasks.map((item) =>
        withCompletionState({
          ...item.task,
          columnName: item.columnName,
          link: item.task.metadata?.link
        })
      );
    },
    {
      params: t.Object({ id: t.String() })
    }
  )
  .get(
    '/:id',
    async ({ params, db, user, set }) => {
      const [task] = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          dueDate: tasks.dueDate,
          priority: tasks.priority,
          columnId: tasks.columnId,
          labels: tasks.labels,
          recurringPattern: tasks.recurringPattern,
          recurringEndDate: tasks.recurringEndDate,
          parentTaskId: tasks.parentTaskId,
          metadata: tasks.metadata,
          createdAt: tasks.createdAt,
          updatedAt: tasks.updatedAt,
          columnName: columns.name,
          boardName: boards.name,
          boardId: boards.id,
          boardSpace: boards.space,
          noteId: tasks.noteId
        })
        .from(tasks)
        .leftJoin(columns, eq(tasks.columnId, columns.id))
        .leftJoin(boards, eq(columns.boardId, boards.id))
        .where(and(eq(tasks.id, params.id), eq(tasks.userId, user.id)));

      if (!task) {
        set.status = 404;
        return { error: 'Task not found' };
      }

      // Fetch subtasks
      const taskSubtasks = await db
        .select()
        .from(subtasks)
        .where(eq(subtasks.taskId, task.id))
        .orderBy(asc(subtasks.order));

      return withCompletionState({
        ...task,
        subtasks: taskSubtasks,
        link: task.metadata?.link
      });
    },
    {
      params: t.Object({ id: t.String() })
    }
  )
  .post(
    '/',
    async ({ body, db, user }) => {
      const metadata = body.link ? { link: body.link } : {};

      // If no columnId provided, find or create a default column
      let columnId = body.columnId;
      if (!columnId) {
        // Find user's first board in the current space (assuming we have space in body or use default)
        const userBoards = await db
          .select()
          .from(boards)
          .where(eq(boards.userId, user.id))
          .limit(1);

        if (userBoards.length === 0) {
          throw new Error('No boards found. Please create a board first.');
        }

        // Find or create a "To Do" column in the first board
        const [defaultColumn] = await db
          .select()
          .from(columns)
          .where(and(eq(columns.boardId, userBoards[0].id), eq(columns.name, 'To Do')))
          .limit(1);

        if (!defaultColumn) {
          // Create a default "To Do" column
          const [newColumn] = await db
            .insert(columns)
            .values({
              boardId: userBoards[0].id,
              name: 'To Do',
              position: 0,
              taskOrder: []
            })
            .returning();
          columnId = newColumn.id;
        } else {
          columnId = defaultColumn.id;
        }
      }

      const [newTask] = await db
        .insert(tasks)
        .values({
          ...body,
          columnId,
          userId: user.id,
          priority: body.priority as 'low' | 'medium' | 'high' | 'urgent',
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          labels: body.labels || [],
          recurringPattern: body.recurringPattern,
          recurringEndDate: body.recurringEndDate ? new Date(body.recurringEndDate) : null,
          parentTaskId: body.parentTaskId,
          reminderMinutesBefore: body.reminderMinutesBefore,
          metadata
        })
        .returning();

      // Auto-create reminder using sync service
      const reminderSync = new ReminderSyncService(db);
      await reminderSync.syncReminders({
        userId: user.id,
        taskId: newTask.id,
        taskTitle: newTask.title,
        columnId: newTask.columnId,
        dueDate: newTask.dueDate,
        reminderOverride: body.reminderMinutesBefore
      });

      // Broadcast task creation
      wsManager.broadcastTaskUpdate(newTask.id, newTask.columnId, 'created');

      return {
        ...newTask,
        link: newTask.metadata?.link
      };
    },
    {
      body: t.Object({
        columnId: t.Optional(t.String()),
        title: t.String(),
        description: t.Optional(t.String()),
        dueDate: t.Optional(t.String()),
        priority: t.Optional(t.String()),
        completed: t.Optional(t.Boolean()),
        labels: t.Optional(t.Array(t.String())),
        subtasks: t.Optional(
          t.Array(
            t.Object({
              title: t.String(),
              completed: t.Optional(t.Boolean()),
              order: t.Optional(t.Number())
            })
          )
        ),
        recurringPattern: t.Optional(t.Union([t.String(), t.Null()])),
        recurringEndDate: t.Optional(t.Union([t.String(), t.Null()])),
        parentTaskId: t.Optional(t.String()),
        reminderMinutesBefore: t.Optional(t.Number()),
        link: t.Optional(t.String())
      })
    }
  )
  .patch(
    '/:id',
    async ({ params, body, db, user }) => {
      // First, get the current task to check if it's recurring
      const [currentTask] = await db.select().from(tasks).where(eq(tasks.id, params.id));

      if (!currentTask) throw new Error('Task not found');

      const updateData: Record<string, unknown> = {
        updatedAt: new Date()
      };

      // Handle specific field updates
      if (body.title !== undefined) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.columnId !== undefined) updateData.columnId = body.columnId;
      if (body.priority !== undefined) updateData.priority = body.priority;

      // Handle completion toggle with recurring-safe semantics
      if (body.completed !== undefined) {
        if (currentTask.recurringPattern) {
          const completionDate = normalizeCompletionDate(body.instanceDate);

          if (body.completed === true) {
            const existing = await db
              .select()
              .from(taskCompletions)
              .where(
                and(
                  eq(taskCompletions.taskId, params.id),
                  eq(taskCompletions.completedDate, completionDate)
                )
              );

            if (existing.length === 0) {
              await db.insert(taskCompletions).values({
                taskId: params.id,
                completedDate: completionDate,
                userId: user.id
              });
            }
          } else {
            await db
              .delete(taskCompletions)
              .where(
                and(
                  eq(taskCompletions.taskId, params.id),
                  eq(taskCompletions.completedDate, completionDate)
                )
              );
          }
        } else {
          const [currentColumn] = await db
            .select()
            .from(columns)
            .where(eq(columns.id, currentTask.columnId));

          if (currentColumn) {
            const boardColumns = await db
              .select({ id: columns.id, name: columns.name })
              .from(columns)
              .where(eq(columns.boardId, currentColumn.boardId));

            updateData.columnId = resolveCompletionColumnId(
              boardColumns,
              body.completed,
              currentTask.columnId
            );
          }
        }
      }
      if (body.labels !== undefined) updateData.labels = body.labels;
      if (body.recurringPattern !== undefined) updateData.recurringPattern = body.recurringPattern;
      if (body.recurringEndDate !== undefined)
        updateData.recurringEndDate = body.recurringEndDate
          ? new Date(body.recurringEndDate)
          : null;
      if (body.dueDate !== undefined) {
        updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      }
      if (body.link !== undefined) {
        updateData.metadata = { ...currentTask.metadata, link: body.link };
      }

      const [updated] = await db
        .update(tasks)
        .set(updateData)
        .where(eq(tasks.id, params.id))
        .returning();

      // Handle subtasks separately (foreign key relation)
      if (body.subtasks !== undefined) {
        // Delete existing subtasks
        await db.delete(subtasks).where(eq(subtasks.taskId, params.id));

        // Insert new subtasks
        if (Array.isArray(body.subtasks) && body.subtasks.length > 0) {
          await db.insert(subtasks).values(
            body.subtasks.map(
              (subtask: { title: string; completed?: boolean; order?: number }, index: number) => ({
                taskId: params.id,
                title: subtask.title,
                completed: subtask.completed ?? false,
                order: subtask.order ?? index
              })
            )
          );
        }
      }

      // Sync reminders when task changes
      const reminderSync = new ReminderSyncService(db);
      await reminderSync.syncReminders({
        userId: user.id,
        taskId: updated.id,
        taskTitle: updated.title,
        columnId: updated.columnId,
        dueDate: updated.dueDate,
        reminderOverride: body.reminderMinutesBefore ?? updated.reminderMinutesBefore
      });

      // Broadcast task update
      wsManager.broadcastTaskUpdate(updated.id, updated.columnId, 'updated');

      return {
        ...updated,
        link: updated.metadata?.link
      };
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
        subtasks: t.Optional(
          t.Array(
            t.Object({
              title: t.String(),
              completed: t.Optional(t.Boolean()),
              order: t.Optional(t.Number())
            })
          )
        ),
        recurringPattern: t.Optional(t.Union([t.String(), t.Null()])),
        recurringEndDate: t.Optional(t.Union([t.String(), t.Null()])),
        reminderMinutesBefore: t.Optional(t.Number()),
        instanceDate: t.Optional(t.String()),
        link: t.Optional(t.String())
      })
    }
  )
  .post(
    '/:id/completion',
    async ({ params, body, db, user, set }) => {
      const [currentTask] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, params.id), eq(tasks.userId, user.id)));

      if (!currentTask) {
        set.status = 404;
        return { error: 'Task not found' };
      }

      if (currentTask.recurringPattern) {
        const completionDate = normalizeCompletionDate(body.instanceDate);

        if (body.completed) {
          const existing = await db
            .select()
            .from(taskCompletions)
            .where(
              and(
                eq(taskCompletions.taskId, currentTask.id),
                eq(taskCompletions.completedDate, completionDate)
              )
            );

          if (existing.length === 0) {
            await db.insert(taskCompletions).values({
              taskId: currentTask.id,
              completedDate: completionDate,
              userId: user.id
            });
          }
        } else {
          await db
            .delete(taskCompletions)
            .where(
              and(
                eq(taskCompletions.taskId, currentTask.id),
                eq(taskCompletions.completedDate, completionDate)
              )
            );
        }

        wsManager.broadcastTaskUpdate(currentTask.id, currentTask.columnId, 'updated');
        return {
          success: true,
          recurring: true,
          taskId: currentTask.id,
          columnId: currentTask.columnId,
          completed: body.completed,
          instanceDate: completionDate
        };
      }

      const [currentColumn] = await db
        .select()
        .from(columns)
        .where(eq(columns.id, currentTask.columnId));

      if (!currentColumn) {
        set.status = 400;
        return { error: 'Task column not found' };
      }

      const boardColumns = await db
        .select({ id: columns.id, name: columns.name })
        .from(columns)
        .where(eq(columns.boardId, currentColumn.boardId));

      const targetColumnId = resolveCompletionColumnId(
        boardColumns,
        body.completed,
        currentTask.columnId
      );

      const [updated] = await db
        .update(tasks)
        .set({
          columnId: targetColumnId,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, currentTask.id))
        .returning();

      const reminderSync = new ReminderSyncService(db);
      await reminderSync.syncReminders({
        userId: user.id,
        taskId: updated.id,
        taskTitle: updated.title,
        columnId: updated.columnId,
        dueDate: updated.dueDate
      });

      wsManager.broadcastTaskUpdate(updated.id, updated.columnId, 'updated');

      return {
        success: true,
        recurring: false,
        task: {
          ...updated,
          link: updated.metadata?.link,
          completed: body.completed,
          completionState: body.completed ? 'completed' : 'active'
        }
      };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        completed: t.Boolean(),
        instanceDate: t.Optional(t.String())
      })
    }
  )
  .delete(
    '/:id',
    async ({ params, db, user, set }) => {
      const [existing] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, params.id), eq(tasks.userId, user.id)));

      if (!existing) {
        set.status = 404;
        return { error: 'Task not found' };
      }

      const [deleted] = await db.transaction(async (tx) => {
        await tx
          .update(pomodoroSessions)
          .set({ taskId: null })
          .where(and(eq(pomodoroSessions.taskId, params.id), eq(pomodoroSessions.userId, user.id)));

        await tx
          .update(pomodoroActiveState)
          .set({ taskId: null })
          .where(
            and(eq(pomodoroActiveState.taskId, params.id), eq(pomodoroActiveState.userId, user.id))
          );

        return tx
          .delete(tasks)
          .where(and(eq(tasks.id, params.id), eq(tasks.userId, user.id)))
          .returning();
      });

      // Broadcast task deletion
      wsManager.broadcastTaskUpdate(deleted.id, deleted.columnId, 'deleted');

      return deleted;
    },
    {
      params: t.Object({ id: t.String() })
    }
  )
  .post(
    '/bulk-complete',
    async ({ body, db, user }) => {
      const { taskIds, completed = true, instanceDate } = body;

      if (!taskIds || taskIds.length === 0) {
        return { success: false, message: 'No task IDs provided', updated: [] };
      }

      // Process tasks in parallel using Promise.all
      const results = await Promise.all(
        taskIds.map(async (taskId) => {
          try {
            // Get the current task
            const [currentTask] = await db
              .select()
              .from(tasks)
              .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));

            if (!currentTask) {
              console.warn(`Task ${taskId} not found or not owned by user`);
              return null;
            }

            if (currentTask.recurringPattern) {
              const completionDate = normalizeCompletionDate(instanceDate);
              if (completed) {
                const existing = await db
                  .select()
                  .from(taskCompletions)
                  .where(
                    and(
                      eq(taskCompletions.taskId, taskId),
                      eq(taskCompletions.completedDate, completionDate)
                    )
                  );

                if (existing.length === 0) {
                  await db.insert(taskCompletions).values({
                    taskId,
                    completedDate: completionDate,
                    userId: user.id
                  });
                }
              } else {
                await db
                  .delete(taskCompletions)
                  .where(
                    and(
                      eq(taskCompletions.taskId, taskId),
                      eq(taskCompletions.completedDate, completionDate)
                    )
                  );
              }

              wsManager.broadcastTaskUpdate(taskId, currentTask.columnId, 'updated');
              return {
                ...currentTask,
                instanceDate: completionDate,
                completed
              };
            }

            const [currentColumn] = await db
              .select()
              .from(columns)
              .where(eq(columns.id, currentTask.columnId));

            if (!currentColumn) {
              console.warn(`Column ${currentTask.columnId} not found for task ${taskId}`);
              return null;
            }

            const boardColumns = await db
              .select({ id: columns.id, name: columns.name })
              .from(columns)
              .where(eq(columns.boardId, currentColumn.boardId));

            const targetColumnId = resolveCompletionColumnId(
              boardColumns,
              completed,
              currentTask.columnId
            );

            const [updated] = await db
              .update(tasks)
              .set({
                columnId: targetColumnId,
                updatedAt: new Date()
              })
              .where(eq(tasks.id, taskId))
              .returning();

            // Broadcast task update
            wsManager.broadcastTaskUpdate(updated.id, updated.columnId, 'updated');

            return updated;
          } catch (error) {
            console.error(`Error updating task ${taskId}:`, error);
            return null;
          }
        })
      );

      const updatedTasks = results.filter((task) => task !== null);

      return {
        success: true,
        message: `Successfully updated ${updatedTasks.length} of ${taskIds.length} tasks`,
        updated: updatedTasks.map((task) => ({
          id: task.id,
          title: task.title,
          columnId: task.columnId
        }))
      };
    },
    {
      body: t.Object({
        taskIds: t.Array(t.String()),
        completed: t.Optional(t.Boolean()),
        instanceDate: t.Optional(t.String())
      })
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
  );
