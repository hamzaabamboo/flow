import { Elysia, t } from 'elysia';
import { eq, and, or, sql, ilike, desc, asc } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import {
  boards,
  columns,
  tasks,
  subtasks,
  reminders,
  taskCompletions
} from '../../../drizzle/schema';
import { wsManager } from '../websocket';

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
      const columnTasks = await db.select().from(tasks).where(eq(tasks.columnId, params.columnId));
      return columnTasks.map((task) => ({
        ...task,
        link: task.metadata?.link
      }));
    },
    {
      params: t.Object({ columnId: t.String() })
    }
  )
  .post(
    '/',
    async ({ body, db, user }) => {
      const metadata = body.link ? { link: body.link } : {};

      const [newTask] = await db
        .insert(tasks)
        .values({
          ...body,
          userId: user.id,
          priority: body.priority as 'low' | 'medium' | 'high' | 'urgent',
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          labels: body.labels || [],
          recurringPattern: body.recurringPattern,
          recurringEndDate: body.recurringEndDate ? new Date(body.recurringEndDate) : null,
          parentTaskId: body.parentTaskId,
          metadata
        })
        .returning();

      // Create reminder if due date is set
      if (body.dueDate && body.createReminder) {
        const reminderTime = new Date(body.dueDate);
        reminderTime.setHours(reminderTime.getHours() - 1);

        await db.insert(reminders).values({
          userId: user.id,
          taskId: String(newTask.id),
          reminderTime,
          message: `Task "${String(newTask.title)}" is due soon`,
          platform: 'discord'
        });
      }

      // Handle recurring task creation
      if (body.recurringPattern && body.dueDate) {
        // This would be handled by a cron job that checks for recurring tasks
        // and creates new instances when needed
      }

      // Broadcast task creation
      wsManager.broadcastTaskUpdate(newTask.id, newTask.columnId, 'created');

      return {
        ...newTask,
        link: newTask.metadata?.link
      };
    },
    {
      body: t.Object({
        columnId: t.String(),
        title: t.String(),
        description: t.Optional(t.String()),
        dueDate: t.Optional(t.String()),
        priority: t.Optional(t.String()),
        completed: t.Optional(t.Boolean()),
        labels: t.Optional(t.Array(t.String())),
        subtasks: t.Optional(t.Any()),
        recurringPattern: t.Optional(t.Union([t.String(), t.Null()])),
        recurringEndDate: t.Optional(t.Union([t.String(), t.Null()])),
        parentTaskId: t.Optional(t.String()),
        createReminder: t.Optional(t.Boolean()),
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
      if (body.completed !== undefined) updateData.completed = body.completed;

      // Auto-move task to Done/In Progress column when completion status changes
      if (body.completed !== undefined && currentTask.completed !== body.completed) {
        // Get the current column to find the board
        const [currentColumn] = await db
          .select()
          .from(columns)
          .where(eq(columns.id, currentTask.columnId));

        if (currentColumn) {
          const boardId = currentColumn.boardId;
          const targetColumnName = body.completed ? 'Done' : 'In Progress';

          // Find the target column
          const [targetColumn] = await db
            .select()
            .from(columns)
            .where(and(eq(columns.boardId, boardId), eq(columns.name, targetColumnName)));

          // Only move if target column exists
          if (targetColumn) {
            updateData.columnId = targetColumn.id;
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
        updateData.metadata = { ...(currentTask.metadata || {}), link: body.link };
      }

      // For recurring tasks, track completion per date instead of updating the task
      if (body.completed !== undefined && currentTask.recurringPattern && body.instanceDate) {
        const instanceDate = new Date(body.instanceDate);
        const dateStr = instanceDate.toISOString().split('T')[0]; // Get just the date part

        if (body.completed === true) {
          // Check if already completed for this date
          const existing = await db
            .select()
            .from(taskCompletions)
            .where(
              and(eq(taskCompletions.taskId, params.id), eq(taskCompletions.completedDate, dateStr))
            );

          if (existing.length === 0) {
            // Create completion record for this specific date
            await db.insert(taskCompletions).values({
              taskId: params.id,
              completedDate: dateStr,
              userId: user.id
            });
          }
        } else {
          // Uncomplete - remove the completion record for this date
          await db
            .delete(taskCompletions)
            .where(
              and(eq(taskCompletions.taskId, params.id), eq(taskCompletions.completedDate, dateStr))
            );
        }

        // Don't update the parent task's completed status
        delete updateData.completed;
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
            message: `Task "${String(updated.title)}" is due soon`,
            platform: 'discord'
          });
        }
      }

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
        subtasks: t.Optional(t.Any()),
        recurringPattern: t.Optional(t.String()),
        recurringEndDate: t.Optional(t.String()),
        updateReminder: t.Optional(t.Boolean()),
        instanceDate: t.Optional(t.String()),
        link: t.Optional(t.String())
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
  );
