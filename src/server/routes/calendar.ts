import { createHash } from 'crypto';
import { Elysia, t } from 'elysia';
import { and, eq, isNotNull, inArray, gte, lte, gt, sql } from 'drizzle-orm';
import ical, { ICalEventStatus, ICalEventRepeatingFreq, ICalWeekday } from 'ical-generator';
import { db } from '../db';
import {
  tasks,
  boards,
  taskCompletions,
  habits,
  columns,
  subtasks,
  externalCalendars
} from '../../../drizzle/schema';
import { withAuth } from '../auth/withAuth';
import { expandRecurringTasks } from '../utils/recurring';
import { fetchAndParseIcal, convertIcalToEvents } from '../utils/ical-parser';
import type { Task } from '../../shared/types/board';
import { jstToUtc, getJstDateComponents } from '../../shared/utils/timezone';
import { logger } from '../logger';

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

    // Create calendar (UTC - ical-generator will handle timezone conversion)
    const calendar = ical({
      name: 'HamFlow Tasks & Habits',
      description: 'Your tasks and habits from HamFlow',
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

      // Use UTC date directly - ical-generator handles timezone conversion
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
      // Parse reminder time or default to 9 AM JST
      const [hours = 9, minutes = 0] = habit.reminderTime
        ? habit.reminderTime.split(':').map(Number)
        : [9, 0];

      // reminderTime is stored as JST time (e.g., "09:00" = 9 AM JST)
      // Get date components from habit creation date in JST
      const createdComponents = getJstDateComponents(new Date(habit.createdAt));

      // Build JST date string with reminder time, then convert to UTC
      const jstDateString = `${createdComponents.year}-${String(createdComponents.month).padStart(2, '0')}-${String(createdComponents.day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

      // Convert JST to UTC for ical-generator
      const startDate = jstToUtc(jstDateString);
      const endDate = new Date(startDate.getTime() + 30 * 60 * 1000); // 30 minute duration

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
      const {
        start,
        end,
        space = 'all',
        includeOverdue = 'false',
        includeNoDueDate = 'false',
        includeUpcoming = 'false'
      } = query;

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

      // Define conditions for main query - only fetch tasks in the date range
      const whereConditions = [
        eq(tasks.userId, user.id),
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, startDate),
        lte(tasks.dueDate, endDate)
      ];
      if (space !== 'all') {
        whereConditions.push(eq(boards.space, space));
      }

      let allTasks = await queryBuilder.where(and(...whereConditions));

      // Fetch recurring tasks without dueDates (so they can still appear in calendar)
      const recurringConditions = [eq(tasks.userId, user.id), isNotNull(tasks.recurringPattern)];
      if (space !== 'all') {
        recurringConditions.push(eq(boards.space, space));
      }

      const recurringQueryBuilder = db
        .select({
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
          space: boards.space,
          boardId: boards.id,
          boardName: boards.name,
          columnName: columns.name
        })
        .from(tasks)
        .leftJoin(columns, eq(tasks.columnId, columns.id))
        .leftJoin(boards, eq(columns.boardId, boards.id))
        .where(and(...recurringConditions));

      const recurringTasks = await recurringQueryBuilder;

      // Merge recurring tasks, avoiding duplicates
      const existingTaskIds = new Set(allTasks.map((t) => t.id));
      const uniqueRecurringTasks = recurringTasks.filter((t) => !existingTaskIds.has(t.id));

      allTasks = [...allTasks, ...uniqueRecurringTasks];

      // If includeNoDueDate is true, fetch tasks without due dates
      if (includeNoDueDate === 'true') {
        const noDueDateConditions = [eq(tasks.userId, user.id), sql`${tasks.dueDate} IS NULL`];
        if (space !== 'all') {
          noDueDateConditions.push(eq(boards.space, space as 'work' | 'personal'));
        }

        const noDueDateQueryBuilder = db
          .select({
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
            space: boards.space,
            boardId: boards.id,
            boardName: boards.name,
            columnName: columns.name
          })
          .from(tasks)
          .leftJoin(columns, eq(tasks.columnId, columns.id))
          .leftJoin(boards, eq(columns.boardId, boards.id))
          .where(and(...noDueDateConditions));

        const noDueDateTasks = await noDueDateQueryBuilder;

        // Filter out completed tasks (in "Done" column) unless they're recurring
        const filteredNoDueDateTasks = noDueDateTasks.filter((task) => {
          const isNotDone = task.columnName?.toLowerCase() !== 'done';
          const isRecurring = !!task.recurringPattern;
          return isNotDone || isRecurring;
        });

        // Merge with existing tasks, avoiding duplicates
        const currentTaskIds = new Set(allTasks.map((t) => t.id));
        const uniqueNoDueDateTasks = filteredNoDueDateTasks.filter(
          (t) => !currentTaskIds.has(t.id)
        );

        allTasks = [...allTasks, ...uniqueNoDueDateTasks];
      }

      // Fetch subtasks separately for the fetched tasks
      const taskIds = allTasks.map((t) => t.id);
      const subtasksData = taskIds.length
        ? await db.select().from(subtasks).where(inArray(subtasks.taskId, taskIds))
        : [];

      // Helper to format tasks
      const formatTask = (task: any) => ({
        ...task,
        description: task.description ?? undefined,
        dueDate: task.dueDate ? task.dueDate.toISOString() : undefined,
        priority: task.priority ?? undefined,
        labels: task.labels ?? undefined,
        recurringPattern: task.recurringPattern ?? undefined,
        recurringEndDate: task.recurringEndDate ? task.recurringEndDate.toISOString() : undefined,
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
      });

      const tasksWithSubtasks = allTasks.map(formatTask);

      // Fetch completions for the main window
      const mainCompletions = await db
        .select()
        .from(taskCompletions)
        .where(
          and(
            eq(taskCompletions.userId, user.id),
            // Expand range slightly to catch edge cases
            gte(
              taskCompletions.completedDate,
              new Date(startDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            ),
            lte(
              taskCompletions.completedDate,
              new Date(endDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            )
          )
        );

      const completionMap = new Map<string, Set<string>>();
      for (const completion of mainCompletions) {
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

      let finalEvents = [...taskEvents];

      // --- HANDLE OVERDUE TASKS ---
      if (includeOverdue === 'true') {
        const overdueConditions = [eq(tasks.userId, user.id), isNotNull(tasks.dueDate)];
        if (space !== 'all') {
          overdueConditions.push(eq(boards.space, space));
        }

        const overdueTasksRaw = await db
          .select({
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
            space: boards.space,
            boardId: boards.id,
            boardName: boards.name,
            columnName: columns.name
          })
          .from(tasks)
          .leftJoin(columns, eq(tasks.columnId, columns.id))
          .leftJoin(boards, eq(columns.boardId, boards.id))
          .where(and(...overdueConditions));

        // 1. NON-RECURRING OVERDUE
        const overdueNonRecurring = overdueTasksRaw.filter((task) => {
          if (!task.dueDate || task.recurringPattern) return false;
          const isNotDone = task.columnName?.toLowerCase() !== 'done';
          const isPast = new Date(task.dueDate) < startDate;
          return isPast && isNotDone;
        });

        // Add non-recurring overdue
        for (const t of overdueNonRecurring) {
          // Avoid duplicates
          if (!finalEvents.find((e) => e.id === t.id)) {
            finalEvents.push({
              ...formatTask(t),
              space: t.space as 'work' | 'personal',
              type: 'task' as const,
              completed: false,
              instanceDate: t.dueDate?.toISOString().split('T')[0] || '',
              dueDate: t.dueDate ? new Date(t.dueDate) : undefined
            });
          }
        }

        // 2. RECURRING OVERDUE
        const overdueRecurring = overdueTasksRaw.filter((task) => !!task.recurringPattern);

        if (overdueRecurring.length > 0) {
          // Lookback 30 days max for performance
          const lookbackStart = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);

          // Fetch completion data for this lookback period
          const overdueCompletions = await db
            .select()
            .from(taskCompletions)
            .where(
              and(
                eq(taskCompletions.userId, user.id),
                gte(taskCompletions.completedDate, lookbackStart.toISOString().split('T')[0]),
                lte(taskCompletions.completedDate, startDate.toISOString().split('T')[0])
              )
            );

          const overdueCompletionMap = new Map<string, Set<string>>();
          for (const completion of overdueCompletions) {
            const taskId = completion.taskId;
            const dateStr = completion.completedDate;
            if (!overdueCompletionMap.has(taskId)) {
              overdueCompletionMap.set(taskId, new Set());
            }
            overdueCompletionMap.get(taskId)!.add(dateStr);
          }

          const overdueFormatted = overdueRecurring.map(formatTask);

          // Expand instances from lookbackStart to startDate (exclusive)
          // We'll treat startDate as the "end" for expansion, so we get strictly past tasks
          const overdueInstances = expandRecurringTasks(
            overdueFormatted as Task[],
            lookbackStart,
            startDate, // End is exclusive effectively in our logic check below
            overdueCompletionMap
          );

          // Filter to keep only those strictly BEFORE startDate and NOT completed
          const actualOverdueInstances = overdueInstances.filter((inst) => {
            if (!inst.dueDate) return false;
            // Must be strictly past
            if (inst.dueDate >= startDate) return false;
            // Must not be completed
            if (inst.completed) return false;
            return true;
          });

          finalEvents.push(...actualOverdueInstances);
        }
      }

      // --- HANDLE UPCOMING TASKS ---
      if (includeUpcoming === 'true') {
        const upcomingEndDate = new Date(endDate.getTime() + 14 * 24 * 60 * 60 * 1000); // +14 days

        const upcomingConditions = [
          eq(tasks.userId, user.id),
          isNotNull(tasks.dueDate),
          gt(tasks.dueDate, endDate),
          lte(tasks.dueDate, upcomingEndDate)
        ];
        if (space !== 'all') {
          upcomingConditions.push(eq(boards.space, space));
        }

        const upcomingTasksRaw = await db
          .select({
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
            space: boards.space,
            boardId: boards.id,
            boardName: boards.name,
            columnName: columns.name
          })
          .from(tasks)
          .leftJoin(columns, eq(tasks.columnId, columns.id))
          .leftJoin(boards, eq(columns.boardId, boards.id))
          .where(and(...upcomingConditions));

        // 1. NON-RECURRING UPCOMING
        const upcomingNonRecurring = upcomingTasksRaw.filter((task) => {
          if (!task.dueDate || task.recurringPattern) return false;
          // Only show if not done
          return task.columnName?.toLowerCase() !== 'done';
        });

        for (const t of upcomingNonRecurring) {
          if (!finalEvents.find((e) => e.id === t.id)) {
            finalEvents.push({
              ...formatTask(t),
              space: t.space as 'work' | 'personal',
              type: 'task' as const,
              completed: false,
              instanceDate: t.dueDate?.toISOString().split('T')[0] || '',
              dueDate: t.dueDate ? new Date(t.dueDate) : undefined
            });
          }
        }

        // 2. RECURRING UPCOMING
        // We need to fetch recurring tasks that MIGHT occur in this upcoming window
        const recurringConditions = [eq(tasks.userId, user.id), isNotNull(tasks.recurringPattern)];
        if (space !== 'all') recurringConditions.push(eq(boards.space, space));

        const possibleRecurringTasks = await db
          .select({
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
            space: boards.space,
            boardId: boards.id,
            boardName: boards.name,
            columnName: columns.name
          })
          .from(tasks)
          .leftJoin(columns, eq(tasks.columnId, columns.id))
          .leftJoin(boards, eq(columns.boardId, boards.id))
          .where(and(...recurringConditions));

        const formattedRecurring = possibleRecurringTasks.map(formatTask);
        // We won't check completions for upcoming - assumption: future tasks are usually not complete yet.
        // But if needed we could. Let's pass empty map for efficiency.

        const upcomingInstances = expandRecurringTasks(
          formattedRecurring as Task[],
          endDate, // Start expansion from end of main period
          upcomingEndDate,
          new Map() // No completions check for future
        ).filter((inst) => {
          // Must be strictly after endDate
          return inst.dueDate && inst.dueDate > endDate;
        });

        // Deduplicate: Only take the FIRST instance for each task ID
        const seenRecurringIds = new Set<string>();
        for (const inst of upcomingInstances) {
          if (!seenRecurringIds.has(inst.id)) {
            seenRecurringIds.add(inst.id);
            finalEvents.push(inst);
          }
        }
      }

      // Fetch external calendar events (unchanged logic, skipping for brevity of diff but implied kept if not touched)
      // NOTE: The previous code block handling external calendars is preserved if we don't overwrite it.
      // But verify_file returned lines 1-629. I need to make sure I don't lose the external calendar part.
      // I will include it to be safe.

      const externalCalendarEvents: any[] = [];
      try {
        const userCalendars = await db
          .select()
          .from(externalCalendars)
          .where(
            and(
              eq(externalCalendars.userId, user.id),
              eq(externalCalendars.enabled, true),
              ...(space !== 'all' ? [eq(externalCalendars.space, space)] : [])
            )
          );

        const calendarPromises = userCalendars.map(async (calendar) => {
          try {
            const icalData = await fetchAndParseIcal(calendar.icalUrl);
            const events = convertIcalToEvents(
              icalData,
              startDate,
              endDate, // External events usually only needed for main view?
              // If user wants upcoming external events too, we'd need to expand window.
              // For now, let's keep it to the main view window to match previous behavior unless requested.
              calendar.id,
              calendar.name,
              calendar.color
            );
            return events;
          } catch (error) {
            logger.error(error, `Failed to fetch external calendar: ${calendar.name}`);
            return [];
          }
        });

        const calendarResults = await Promise.all(calendarPromises);
        externalCalendarEvents.push(...calendarResults.flat());
      } catch (error) {
        logger.error(error, 'Failed to fetch external calendars');
      }

      // Combine HamFlow events and external calendar events, then sort by date
      const allEvents = [...finalEvents, ...externalCalendarEvents].toSorted((a, b) => {
        const aDate = a.dueDate ? new Date(a.dueDate) : null;
        const bDate = b.dueDate ? new Date(b.dueDate) : null;

        if (!aDate || !bDate) return 0;
        return aDate.getTime() - bDate.getTime();
      });

      return allEvents;
    },
    {
      query: t.Object({
        start: t.String(),
        end: t.String(),
        space: t.Optional(t.Union([t.Literal('all'), t.Literal('work'), t.Literal('personal')])),
        includeOverdue: t.Optional(t.String()),
        includeNoDueDate: t.Optional(t.String()),
        includeUpcoming: t.Optional(t.String())
      })
    }
  );
