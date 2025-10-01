import { createHash } from 'crypto';
import { Elysia, t } from 'elysia';
import { and, eq, gte, lte, isNotNull, isNull, inArray, between } from 'drizzle-orm';
import { db } from '../db';
import {
  tasks,
  boards,
  reminders,
  pomodoroSessions,
  taskCompletions,
  habits,
  habitLogs,
  columns,
  subtasks
} from '../../../drizzle/schema';
import { withAuth } from '../auth/withAuth';
import { expandRecurringTasks } from '../utils/recurring';
import type { Task } from '../../shared/types/board';

// Helper function to format date for iCal
function formatICalDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

// Helper function to escape text for iCal
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Generate a unique ID for iCal events
function generateEventId(id: string, domain: string = 'hamflow.local'): string {
  return `${id}@${domain}`;
}

export const calendarRoutes = new Elysia({ prefix: '/calendar' })
  .use(withAuth())
  .decorate('db', db)
  // Get iCal feed URL (returns the URL for subscription)
  .get('/feed-url', ({ user }) => {
    // Generate a secure token for the user's calendar feed
    const token = createHash('sha256')
      .update(`${user.id}-${process.env.CALENDAR_SECRET || 'hamflow-calendar'}`)
      .digest('hex');

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    return {
      url: `${baseUrl}/api/calendar/ical/${user.id}/${token}`,
      instructions:
        'Add this URL to your calendar app (Google Calendar, Apple Calendar, Outlook, etc.) as a subscription'
    };
  })

  // Generate iCal feed for tasks and reminders
  .get(
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

      // Fetch user's tasks with due dates
      const userTasks = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          dueDate: tasks.dueDate,
          priority: tasks.priority,
          completed: tasks.completed,
          recurringPattern: tasks.recurringPattern,
          recurringEndDate: tasks.recurringEndDate,
          boardId: boards.id,
          boardName: boards.name,
          space: boards.space
        })
        .from(tasks)
        .leftJoin(boards, eq(tasks.columnId, boards.id))
        .where(and(eq(tasks.userId, userId), isNotNull(tasks.dueDate)));

      // Fetch reminders
      const userReminders = await db.select().from(reminders).where(eq(reminders.userId, userId));

      // Fetch habits for recurring events
      const allUserHabits = await db.select().from(habits).where(eq(habits.userId, userId));

      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);

      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);

      // Fetch habit logs for the date range
      const logs = await db
        .select()
        .from(habitLogs)
        .where(
          and(
            inArray(
              habitLogs.habitId,
              allUserHabits.map((h) => h.id)
            ),
            between(habitLogs.date, startDate, endDate)
          )
        );

      // Fetch recent pomodoro sessions
      const recentPomodoros = await db
        .select()
        .from(pomodoroSessions)
        .where(
          and(
            eq(pomodoroSessions.userId, userId),
            gte(pomodoroSessions.startTime, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
          )
        );

      // Build iCal content
      const ical = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//HamFlow//Tasks Calendar//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:HamFlow Tasks',
        'X-WR-TIMEZONE:UTC',
        'X-WR-CALDESC:Tasks and reminders from HamFlow'
      ];

      // Add tasks as events
      for (const task of userTasks) {
        if (!task.dueDate) continue;

        const eventId = generateEventId(task.id);
        const now = new Date();
        const dueDate = new Date(task.dueDate);

        // Set event duration (1 hour default for tasks)
        const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000);

        ical.push('BEGIN:VEVENT');
        ical.push(`UID:${eventId}`);
        ical.push(`DTSTAMP:${formatICalDate(now)}`);
        ical.push(`DTSTART:${formatICalDate(dueDate)}`);
        ical.push(`DTEND:${formatICalDate(endDate)}`);
        ical.push(`SUMMARY:${escapeICalText(`[${task.space || 'work'}] ${task.title}`)}`);

        if (task.description) {
          ical.push(`DESCRIPTION:${escapeICalText(task.description)}`);
        }

        if (task.priority) {
          const priorityMap: Record<string, number> = {
            urgent: 1,
            high: 3,
            medium: 5,
            low: 7
          };
          ical.push(`PRIORITY:${priorityMap[task.priority] || 5}`);
        }

        if (task.completed) {
          ical.push('STATUS:COMPLETED');
        } else {
          ical.push('STATUS:CONFIRMED');
        }

        // Add RRULE for recurring tasks
        if (task.recurringPattern) {
          const pattern = task.recurringPattern.toLowerCase();
          let rrule = '';
          if (pattern === 'daily') {
            rrule = 'RRULE:FREQ=DAILY';
          } else if (pattern === 'weekly') {
            rrule = 'RRULE:FREQ=WEEKLY';
          } else if (pattern === 'monthly') {
            rrule = 'RRULE:FREQ=MONTHLY';
          } else if (pattern === 'yearly') {
            rrule = 'RRULE:FREQ=YEARLY';
          }

          // Add UNTIL parameter if recurring end date is set
          if (rrule && task.recurringEndDate) {
            const endDate = new Date(task.recurringEndDate);
            rrule += `;UNTIL=${formatICalDate(endDate)}`;
          }

          if (rrule) {
            ical.push(rrule);
          }
        }

        ical.push(`CATEGORIES:${task.space || 'work'},${task.boardName || 'tasks'}`);
        ical.push('END:VEVENT');
      }

      // Add reminders as events
      for (const reminder of userReminders) {
        const eventId = generateEventId(`reminder-${reminder.id}`);
        const now = new Date();
        const reminderDate = new Date(reminder.reminderTime);
        const endDate = new Date(reminderDate.getTime() + 15 * 60 * 1000); // 15 min duration

        ical.push('BEGIN:VEVENT');
        ical.push(`UID:${eventId}`);
        ical.push(`DTSTAMP:${formatICalDate(now)}`);
        ical.push(`DTSTART:${formatICalDate(reminderDate)}`);
        ical.push(`DTEND:${formatICalDate(endDate)}`);
        ical.push(`SUMMARY:${escapeICalText(`[Reminder] ${reminder.message}`)}`);
        ical.push('STATUS:CONFIRMED');
        ical.push('CATEGORIES:reminders');

        // Add alarm 5 minutes before
        ical.push('BEGIN:VALARM');
        ical.push('TRIGGER:-PT5M');
        ical.push('ACTION:DISPLAY');
        ical.push(`DESCRIPTION:${escapeICalText(reminder.message)}`);
        ical.push('END:VALARM');

        ical.push('END:VEVENT');
      }

      // Add completed pomodoro sessions
      for (const session of recentPomodoros) {
        if (!session.endTime) continue;

        const eventId = generateEventId(`pomodoro-${session.id}`);
        const now = new Date();

        ical.push('BEGIN:VEVENT');
        ical.push(`UID:${eventId}`);
        ical.push(`DTSTAMP:${formatICalDate(now)}`);
        ical.push(`DTSTART:${formatICalDate(new Date(session.startTime))}`);
        ical.push(`DTEND:${formatICalDate(new Date(session.endTime))}`);
        ical.push(`SUMMARY:${escapeICalText(`🍅 Pomodoro: ${session.type}`)}`);
        ical.push('STATUS:COMPLETED');
        ical.push('CATEGORIES:pomodoro');
        ical.push('END:VEVENT');
      }

      // Add habits as recurring daily events
      for (const habit of allUserHabits) {
        const eventId = generateEventId(`habit-${habit.id}`);
        const now = new Date();

        // Set start time to 9 AM today
        const startDate = new Date();
        startDate.setHours(9, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setMinutes(30); // 30 minute duration for habits

        ical.push('BEGIN:VEVENT');
        ical.push(`UID:${eventId}`);
        ical.push(`DTSTAMP:${formatICalDate(now)}`);
        ical.push(`DTSTART:${formatICalDate(startDate)}`);
        ical.push(`DTEND:${formatICalDate(endDate)}`);
        ical.push(`SUMMARY:${escapeICalText(`[Habit] ${habit.name}`)}`);

        if (habit.description) {
          ical.push(`DESCRIPTION:${escapeICalText(habit.description)}`);
        }

        // Add recurrence rule based on frequency
        if (habit.frequency === 'daily') {
          ical.push('RRULE:FREQ=DAILY');
        } else if (habit.frequency === 'weekly') {
          // For weekly habits, specify which days
          const targetDays = habit.targetDays || [];
          const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
          const byDay = targetDays.map((d) => dayNames[d]).join(',');
          if (byDay) {
            ical.push(`RRULE:FREQ=WEEKLY;BYDAY=${byDay}`);
          } else {
            ical.push('RRULE:FREQ=WEEKLY');
          }
        }

        ical.push('STATUS:CONFIRMED');
        ical.push('CATEGORIES:habits');

        // Add a reminder 15 minutes before
        ical.push('BEGIN:VALARM');
        ical.push('TRIGGER:-PT15M');
        ical.push('ACTION:DISPLAY');
        ical.push(`DESCRIPTION:${escapeICalText(`Time for: ${habit.name}`)}`);
        ical.push('END:VALARM');

        ical.push('END:VEVENT');
      }

      ical.push('END:VCALENDAR');

      // Set response headers for iCal
      set.headers = {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="hamflow.ics"'
      };

      return ical.join('\r\n');
    },
    {
      params: t.Object({
        userId: t.String(),
        token: t.String()
      })
    }
  )

  // Get calendar events for a date range (JSON format for frontend)
  .get(
    '/events',
    async ({ query, db, user }) => {
      const { start, end, space = 'all' } = query;

      const startDate = new Date(start);
      const endDate = new Date(end);

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
          completed: tasks.completed,
          labels: tasks.labels,
          recurringPattern: tasks.recurringPattern,
          recurringEndDate: tasks.recurringEndDate,
          parentTaskId: tasks.parentTaskId,
          createdAt: tasks.createdAt,
          updatedAt: tasks.updatedAt,
          // Manually join board space for filtering
          space: boards.space
        })
        .from(tasks)
        .leftJoin(columns, eq(tasks.columnId, columns.id))
        .leftJoin(boards, eq(columns.boardId, boards.id));

      // Define conditions
      const whereConditions = [eq(tasks.userId, user.id), isNull(tasks.parentTaskId)];
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
        recurringEndDate: task.recurringEndDate ? task.recurringEndDate.toISOString() : undefined,
        parentTaskId: task.parentTaskId ?? undefined,
        space: task.space ?? undefined,
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
      const taskEvents = expandRecurringTasks(tasksWithSubtasks as Task[], startDate, endDate, completionMap);

      // Fetch reminders in range
      const remindersData = await db
        .select({
          id: reminders.id,
          message: reminders.message,
          reminderTime: reminders.reminderTime
        })
        .from(reminders)
        .where(
          and(
            eq(reminders.userId, user.id),
            gte(reminders.reminderTime, startDate),
            lte(reminders.reminderTime, endDate)
          )
        );

      const reminderEvents = remindersData.map((reminder) => ({
        id: reminder.id,
        title: reminder.message,
        dueDate: reminder.reminderTime,
        type: 'reminder' as const
      }));

      // Combine and sort by date
      const allEvents = [...taskEvents, ...reminderEvents].sort((a, b) => {
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

  // Create a calendar event from a task
  .post(
    '/create-from-task',
    async ({ body, db, user }) => {
      const { taskId } = body;

      // Get task details
      const [task] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
        .limit(1);

      if (!task) {
        return { error: 'Task not found' };
      }

      // Return iCal format for this specific task
      const now = new Date();
      const dueDate = task.dueDate || new Date();
      const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000);

      const ical = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//HamFlow//Task Event//EN',
        'BEGIN:VEVENT',
        `UID:${generateEventId(task.id)}`,
        `DTSTAMP:${formatICalDate(now)}`,
        `DTSTART:${formatICalDate(dueDate)}`,
        `DTEND:${formatICalDate(endDate)}`,
        `SUMMARY:${escapeICalText(task.title)}`,
        task.description ? `DESCRIPTION:${escapeICalText(task.description)}` : '',
        'END:VEVENT',
        'END:VCALENDAR'
      ]
        .filter((line) => line)
        .join('\r\n');

      return {
        ical,
        downloadUrl: `/api/calendar/download-task/${taskId}`
      };
    },
    {
      body: t.Object({
        taskId: t.String()
      })
    }
  );
