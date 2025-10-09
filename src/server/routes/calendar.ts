import { createHash } from 'crypto';
import { Elysia, t } from 'elysia';
import { and, eq, isNotNull, inArray, gte, lte } from 'drizzle-orm';
import ical, { ICalEventStatus, ICalEventRepeatingFreq, ICalWeekday } from 'ical-generator';
import { db } from '../db';
import { tasks, boards, taskCompletions, habits, columns, subtasks } from '../../../drizzle/schema';
import { withAuth } from '../auth/withAuth';
import { expandRecurringTasks } from '../utils/recurring';
import type { Task } from '../../shared/types/board';

// Public iCal route (no auth required)
export const publicCalendarRoutes = new Elysia({ prefix: '/api/calendar' }).decorate('db', db).get(
  '/ical/:userId/:token',
  async ({ params, db, set }) => {
    const { userId, token } = params;

    // Verify token
    const expectedToken = createHash('sha256')
      .update(`${userId}-${process.env.CALENDAR_SECRET || 'hamflow-calendar'}`)
      .digest('hex');

    if (token !== expectedToken) {
      set.status = 401;
      return 'Unauthorized';
    }

    // Create calendar
    const calendar = ical({
      name: 'HamFlow Tasks & Habits',
      description: 'Your tasks and habits from HamFlow',
      timezone: 'UTC',
      prodId: {
        company: 'HamFlow',
        product: 'Tasks Calendar'
      }
    });

    // Fetch user's tasks with due dates
    const userTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        dueDate: tasks.dueDate,
        priority: tasks.priority,
        columnName: columns.name,
        recurringPattern: tasks.recurringPattern,
        recurringEndDate: tasks.recurringEndDate,
        metadata: tasks.metadata,
        boardId: boards.id,
        boardName: boards.name,
        space: boards.space
      })
      .from(tasks)
      .leftJoin(columns, eq(tasks.columnId, columns.id))
      .leftJoin(boards, eq(columns.boardId, boards.id))
      .where(and(eq(tasks.userId, userId), isNotNull(tasks.dueDate)));

    // Add tasks as events
    for (const task of userTasks) {
      if (!task.dueDate) continue;

      const dueDate = new Date(task.dueDate);
      const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000); // 1 hour duration

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const taskUrl = task.boardId
        ? `${frontendUrl}/board/${task.boardId}`
        : `${frontendUrl}/agenda?date=${dueDate.toISOString().split('T')[0]}`;

      // Build description with metadata link if available
      let eventDescription = task.description || '';
      if (task.metadata?.link) {
        eventDescription = eventDescription
          ? `${eventDescription}\n\nLink: ${task.metadata.link}`
          : `Link: ${task.metadata.link}`;
      }

      const event = calendar.createEvent({
        id: task.id,
        start: dueDate,
        end: endDate,
        summary: `[${task.space || 'work'}] ${task.title}`,
        description: eventDescription || undefined,
        categories: [{ name: task.space || 'work' }, { name: task.boardName || 'tasks' }],
        url: taskUrl
      });

      // Set status - CANCELLED if in Done column, otherwise CONFIRMED
      const isCompleted = task.columnName?.toLowerCase() === 'done';
      event.status(isCompleted ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED);

      // Set priority
      if (task.priority) {
        const priorityMap: Record<string, number> = {
          urgent: 1,
          high: 3,
          medium: 5,
          low: 7
        };
        event.priority(priorityMap[task.priority] || 5);
      }

      // Add RRULE for recurring tasks
      if (task.recurringPattern) {
        const pattern = task.recurringPattern.toLowerCase();

        let freq: ICalEventRepeatingFreq | undefined;
        let interval: number | undefined;

        if (pattern === 'daily') {
          freq = ICalEventRepeatingFreq.DAILY;
        } else if (pattern === 'weekly') {
          freq = ICalEventRepeatingFreq.WEEKLY;
        } else if (pattern === 'biweekly') {
          freq = ICalEventRepeatingFreq.WEEKLY;
          interval = 2; // Every 2 weeks
        } else if (pattern === 'monthly') {
          freq = ICalEventRepeatingFreq.MONTHLY;
        } else if (pattern === 'end_of_month') {
          freq = ICalEventRepeatingFreq.MONTHLY;
          // Will occur on the last day of each month
        } else if (pattern === 'yearly') {
          freq = ICalEventRepeatingFreq.YEARLY;
        }

        if (freq) {
          const repeatOptions: {
            freq: ICalEventRepeatingFreq;
            until?: Date;
            interval?: number;
            byMonthDay?: number;
          } = {
            freq,
            until: task.recurringEndDate ? new Date(task.recurringEndDate) : undefined
          };

          if (interval) {
            repeatOptions.interval = interval;
          }

          // For end_of_month, set to last day
          if (pattern === 'end_of_month') {
            repeatOptions.byMonthDay = -1; // Last day of month
          }

          event.repeating(repeatOptions);
        }
      }
    }

    // Fetch habits for recurring events (only active habits)
    const allUserHabits = await db
      .select()
      .from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.active, true)));

    // Add habits as recurring events
    for (const habit of allUserHabits) {
      // Parse reminder time or default to 9 AM
      const [hours = 9, minutes = 0] = habit.reminderTime
        ? habit.reminderTime.split(':').map(Number)
        : [9, 0];

      // Use habit creation date as the start date
      const startDate = new Date(habit.createdAt);
      startDate.setUTCHours(hours, minutes, 0, 0);
      const endDate = new Date(startDate);
      endDate.setUTCMinutes(minutes + 30); // 30 minute duration for habits

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const habitUrl = `${frontendUrl}/agenda?date=${startDate.toISOString().split('T')[0]}`;

      // Build description with metadata link if available
      let habitDescription = habit.description || '';
      if (habit.metadata?.link) {
        habitDescription = habitDescription
          ? `${habitDescription}\n\nLink: ${habit.metadata.link}`
          : `Link: ${habit.metadata.link}`;
      }

      const event = calendar.createEvent({
        id: `habit-${habit.id}`,
        start: startDate,
        end: endDate,
        summary: habit.name,
        description: habitDescription || undefined,
        categories: [{ name: habit.space || 'personal' }, { name: 'habits' }],
        allDay: false,
        url: habitUrl
      });

      event.status(ICalEventStatus.CONFIRMED);
      event.priority(5); // Default priority for habits

      // Add recurrence rule based on frequency
      if (habit.frequency === 'daily') {
        event.repeating({ freq: ICalEventRepeatingFreq.DAILY });
      } else if (habit.frequency === 'weekly') {
        // For weekly habits, specify which days
        const targetDays = habit.targetDays || [];
        const dayNames: ICalWeekday[] = [
          ICalWeekday.SU,
          ICalWeekday.MO,
          ICalWeekday.TU,
          ICalWeekday.WE,
          ICalWeekday.TH,
          ICalWeekday.FR,
          ICalWeekday.SA
        ];
        const byDay = targetDays.map((d) => dayNames[d]);

        event.repeating({
          freq: ICalEventRepeatingFreq.WEEKLY,
          byDay: byDay.length > 0 ? byDay : undefined
        });
      }
    }

    // Set response headers for iCal
    set.headers = {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="hamflow.ics"'
    };

    return calendar.toString();
  },
  {
    params: t.Object({
      userId: t.String(),
      token: t.String()
    })
  }
);

// Authenticated calendar routes
export const calendarRoutes = new Elysia({ prefix: '/calendar' })
  .decorate('db', db)
  .group('', (app) =>
    app
      .use(withAuth())

      // Get iCal feed URL (returns the URL for subscription)
      .get('/feed-url', ({ user }) => {
        // Generate a secure token for the user's calendar feed
        const token = createHash('sha256')
          .update(`${user.id}-${process.env.CALENDAR_SECRET || 'hamflow-calendar'}`)
          .digest('hex');

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        return {
          url: `${frontendUrl}/api/calendar/ical/${user.id}/${token}`,
          instructions:
            'Add this URL to your calendar app (Google Calendar, Apple Calendar, Outlook, etc.) as a subscription'
        };
      })

      // Get calendar events for a date range (JSON format for frontend)
      .get(
        '/events',
        async ({ query, db, user }) => {
          const { start, end, space = 'all' } = query;

          // Convert UNIX timestamps (seconds) to Date objects
          const startDate = new Date(parseInt(start) * 1000);
          const endDate = new Date(parseInt(end) * 1000);

          // Build the query with joins
          const queryBuilder = db
            .select({
              // Select all columns from tasks
              id: tasks.id,
              columnId: tasks.columnId,
              userId: tasks.userId,
              title: tasks.title,
              description: tasks.description,
              dueDate: tasks.dueDate,
              priority: tasks.priority,
              noteId: tasks.noteId,
              labels: tasks.labels,
              recurringPattern: tasks.recurringPattern,
              recurringEndDate: tasks.recurringEndDate,
              parentTaskId: tasks.parentTaskId,
              metadata: tasks.metadata,
              createdAt: tasks.createdAt,
              updatedAt: tasks.updatedAt,
              // Manually join board space for filtering
              space: boards.space,
              boardId: boards.id,
              boardName: boards.name,
              columnName: columns.name
            })
            .from(tasks)
            .leftJoin(columns, eq(tasks.columnId, columns.id))
            .leftJoin(boards, eq(columns.boardId, boards.id));

          // Define conditions
          const whereConditions = [eq(tasks.userId, user.id)];
          if (space !== 'all') {
            whereConditions.push(eq(boards.space, space));
          }

          const allTasks = await queryBuilder.where(and(...whereConditions));

          // Fetch subtasks separately for the fetched tasks
          const taskIds = allTasks.map((t) => t.id);
          const subtasksData = taskIds.length
            ? await db.select().from(subtasks).where(inArray(subtasks.taskId, taskIds))
            : [];

          // Manually attach subtasks to their parent tasks and normalize types
          const tasksWithSubtasks = allTasks.map((task) => ({
            ...task,
            description: task.description ?? undefined,
            dueDate: task.dueDate ? task.dueDate.toISOString() : undefined,
            priority: task.priority ?? undefined,
            labels: task.labels ?? undefined,
            recurringPattern: task.recurringPattern ?? undefined,
            recurringEndDate: task.recurringEndDate
              ? task.recurringEndDate.toISOString()
              : undefined,
            parentTaskId: task.parentTaskId ?? undefined,
            space: task.space ?? undefined,
            boardId: task.boardId ?? undefined,
            boardName: task.boardName ?? undefined,
            columnName: task.columnName ?? undefined,
            link: task.metadata?.link ?? undefined,
            createdAt: task.createdAt?.toISOString(),
            updatedAt: task.updatedAt?.toISOString(),
            subtasks: subtasksData
              .filter((st) => st.taskId === task.id)
              .map((st) => ({
                ...st,
                completed: st.completed ?? false,
                createdAt: st.createdAt.toISOString(),
                updatedAt: st.updatedAt.toISOString()
              }))
          }));

          // Fetch all task completions for the user's tasks in the date range
          const completions = await db
            .select()
            .from(taskCompletions)
            .where(
              and(
                eq(taskCompletions.userId, user.id),
                gte(taskCompletions.completedDate, startDate.toISOString().split('T')[0]),
                lte(taskCompletions.completedDate, endDate.toISOString().split('T')[0])
              )
            );

          // Create a map of task completions by taskId and date
          const completionMap = new Map<string, Set<string>>();
          for (const completion of completions) {
            const taskId = completion.taskId;
            const dateStr = completion.completedDate;
            if (!completionMap.has(taskId)) {
              completionMap.set(taskId, new Set());
            }
            completionMap.get(taskId)!.add(dateStr);
          }

          // Expand recurring tasks into individual instances
          const taskEvents = expandRecurringTasks(
            tasksWithSubtasks as Task[],
            startDate,
            endDate,
            completionMap
          );

          // Combine and sort by date
          const allEvents = [...taskEvents].toSorted((a, b) => {
            const aDate = a.dueDate;
            const bDate = b.dueDate;
            if (!aDate || !bDate) return 0;
            if (aDate instanceof Date && bDate instanceof Date) {
              return aDate.getTime() - bDate.getTime();
            }
            return 0;
          });

          return allEvents;
        },
        {
          query: t.Object({
            start: t.String(),
            end: t.String(),
            space: t.Optional(t.Union([t.Literal('all'), t.Literal('work'), t.Literal('personal')]))
          })
        }
      )
  );
