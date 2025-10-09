import { Elysia, t } from 'elysia';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { tasks, columns, boards, inboxItems } from '../../../drizzle/schema';
import { withAuth } from '../auth/withAuth';
import { isTaskCompleted } from '../utils/taskCompletion';

export const statsRoutes = new Elysia({ prefix: '/stats' })
  .decorate('db', db)
  .use(withAuth())

  .get('/test', () => ({ test: 'working' }))

  .get(
    '/badges',
    async ({ query, db, user }) => {
      const { space = 'all' } = query;
      const today = new Date().toISOString().split('T')[0];

      // Fetch inbox count (only unprocessed items)
      const inboxWhere =
        space === 'all'
          ? and(eq(inboxItems.userId, user.id), eq(inboxItems.processed, false))
          : and(
              eq(inboxItems.userId, user.id),
              eq(inboxItems.space, space as 'work' | 'personal'),
              eq(inboxItems.processed, false)
            );
      const inbox = await db.select().from(inboxItems).where(inboxWhere);
      const inboxCount = inbox.length;

      // Fetch tasks with columns
      const tasksWhere =
        space === 'all'
          ? eq(tasks.userId, user.id)
          : and(eq(tasks.userId, user.id), eq(boards.space, space as 'work' | 'personal'));

      const userTasks = await db
        .select({
          task: tasks,
          columnName: columns.name
        })
        .from(tasks)
        .leftJoin(columns, eq(tasks.columnId, columns.id))
        .leftJoin(boards, eq(columns.boardId, boards.id))
        .where(tasksWhere);

      const tasksWithColumns = userTasks.map((t) => ({
        ...t.task,
        columnName: t.columnName ?? null
      }));

      // Count incomplete tasks (due today or overdue)
      const incompleteTasks = tasksWithColumns.filter((task) => {
        if (isTaskCompleted(task.columnName)) return false;
        if (!task.dueDate) return false;
        // Compare dates only (strip time)
        const dueDate = new Date(task.dueDate);
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const todayDateOnly = new Date(today);
        return dueDateOnly <= todayDateOnly; // Today or overdue
      });

      // Fetch habits for today
      const habitsResponse = await fetch(
        `${process.env.BASE_URL || 'http://localhost:3000'}/api/habits?date=${today}&space=${space}`,
        {
          headers: { 'x-user-id': user.id }
        }
      );
      const habits = habitsResponse.ok ? await habitsResponse.json() : [];
      const incompleteHabits = habits.filter((h: any) => !h.completedToday);

      // Count all incomplete tasks (for Tasks badge)
      const allIncompleteTasks = tasksWithColumns.filter(
        (task) => !isTaskCompleted(task.columnName)
      );

      return {
        inbox: inboxCount,
        agenda: incompleteTasks.length + incompleteHabits.length,
        tasks: allIncompleteTasks.length
      };
    },
    {
      query: t.Object({
        space: t.Optional(t.Union([t.Literal('all'), t.Literal('work'), t.Literal('personal')]))
      })
    }
  );
