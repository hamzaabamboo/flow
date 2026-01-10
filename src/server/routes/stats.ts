import { Elysia, t } from 'elysia';
import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import { tasks, columns, boards, inboxItems } from '../../../drizzle/schema';
import { withAuth } from '../auth/withAuth';
import { isTaskCompleted } from '../utils/taskCompletion';
import { jstToUtc, getJstDateComponents } from '../../shared/utils/timezone';

interface Habit {
  id: string;
  name: string;
  completedToday: boolean;
}

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
      const habits = (habitsResponse.ok ? await habitsResponse.json() : []) as Habit[];
      const incompleteHabits = habits.filter((h) => !h.completedToday);

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
  )

  // Get task completion analytics by date range (uses tasks in Done columns)
  .get(
    '/analytics/completions',
    async ({ query, db, user }) => {
      const { startDate, endDate, space = 'all' } = query;

      // Parse dates as JST and convert to UTC for database queries
      // Input: "2025-10-20" means JST date 2025-10-20 00:00:00
      const startUtc = jstToUtc(`${startDate}T00:00:00`);
      const endUtc = jstToUtc(`${endDate}T23:59:59`);

      // Fetch all tasks with their column names
      const tasksWhere =
        space === 'all'
          ? and(
              eq(tasks.userId, user.id),
              gte(tasks.updatedAt, startUtc),
              lte(tasks.updatedAt, endUtc)
            )
          : and(
              eq(tasks.userId, user.id),
              eq(boards.space, space as 'work' | 'personal'),
              gte(tasks.updatedAt, startUtc),
              lte(tasks.updatedAt, endUtc)
            );

      const allTasks = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          updatedAt: tasks.updatedAt,
          columnName: columns.name
        })
        .from(tasks)
        .leftJoin(columns, eq(tasks.columnId, columns.id))
        .leftJoin(boards, eq(columns.boardId, boards.id))
        .where(tasksWhere);

      // Filter to only completed tasks (in Done columns)
      const completedTasks = allTasks.filter((task) => isTaskCompleted(task.columnName));

      // Group by JST date (not UTC date)
      const groupedByDate: Record<
        string,
        Array<{ id: string; title: string; updatedAt: Date | null }>
      > = {};

      completedTasks.forEach((task) => {
        if (!task.updatedAt) return;

        // Convert UTC timestamp to JST and extract date
        const jstComponents = getJstDateComponents(task.updatedAt);
        const dateKey = `${jstComponents.year}-${String(jstComponents.month).padStart(2, '0')}-${String(jstComponents.day).padStart(2, '0')}`;

        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push({
          id: task.id,
          title: task.title,
          updatedAt: task.updatedAt
        });
      });

      // Convert to array format
      const completions = Object.entries(groupedByDate)
        .map(([date, tasks]) => ({
          date,
          count: tasks.length,
          tasks
        }))
        .toSorted((a, b) => a.date.localeCompare(b.date));

      return {
        startDate,
        endDate,
        space,
        completions
      };
    },
    {
      query: t.Object({
        startDate: t.String(),
        endDate: t.String(),
        space: t.Optional(t.Union([t.Literal('all'), t.Literal('work'), t.Literal('personal')]))
      })
    }
  );
