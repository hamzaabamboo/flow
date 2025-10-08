import { Elysia, t } from 'elysia';
import { eq, and, or, sql, ilike, desc, asc } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { boards, columns, tasks, subtasks, taskCompletions } from '../../../drizzle/schema';
import { wsManager } from '../websocket';
import { ReminderSyncService } from '../services/reminder-sync';

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
        subtasks: t.Optional(t.Any()),
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

      // Handle completion toggle by moving to Done/In Progress column
      if (body.completed !== undefined) {
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
        updateData.metadata = { ...currentTask.metadata, link: body.link };
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
        subtasks: t.Optional(t.Any()),
        recurringPattern: t.Optional(t.String()),
        recurringEndDate: t.Optional(t.String()),
        reminderMinutesBefore: t.Optional(t.Number()),
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
