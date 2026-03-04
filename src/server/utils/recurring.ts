import type { Task } from '../../shared/types/board';
import type { CalendarEvent } from '../../shared/types/calendar';
import { isColumnDone } from './taskCompletion';

type RecurringTaskSource = Task | CalendarEvent;

export function expandRecurringTasks(
  tasks: RecurringTaskSource[],
  startDate: Date,
  endDate: Date,
  completionMap: Map<string, Set<string>>
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const task of tasks) {
    // For non-recurring tasks, skip if no dueDate
    if (!task.dueDate && !task.recurringPattern) continue;

    // For recurring tasks without dueDate, use createdAt or startDate as the start
    const taskDueDate = task.dueDate
      ? new Date(task.dueDate)
      : task.createdAt
        ? new Date(task.createdAt)
        : new Date(startDate);

    const formattedTask: CalendarEvent = {
      ...(task as unknown as CalendarEvent),
      space: task.space,
      type: 'task' as const
    };

    if (!task.recurringPattern) {
      if (taskDueDate >= startDate && taskDueDate <= endDate) {
        events.push({
          ...formattedTask,
          completed: task.columnName ? isColumnDone(task.columnName) : false
        });
      }
      continue;
    }

    const pattern = task.recurringPattern.toLowerCase();
    const recurringEndDate = task.recurringEndDate ? new Date(task.recurringEndDate) : null;
    const effectiveEndDate =
      recurringEndDate && recurringEndDate < endDate ? recurringEndDate : endDate;

    if (pattern === 'daily') {
      const startDay = new Date(startDate);
      startDay.setUTCHours(0, 0, 0, 0);

      const taskStartDay = new Date(taskDueDate);
      taskStartDay.setUTCHours(0, 0, 0, 0);

      const currentDay = taskStartDay < startDay ? new Date(startDay) : new Date(taskStartDay);
      currentDay.setUTCHours(0, 0, 0, 0);

      for (
        ;
        currentDay.getTime() <= effectiveEndDate.getTime();
        currentDay.setUTCDate(currentDay.getUTCDate() + 1)
      ) {
        const instance = new Date(currentDay);
        instance.setUTCHours(taskDueDate.getUTCHours(), taskDueDate.getUTCMinutes(), 0, 0);

        const dateStr = instance.toISOString().split('T')[0];

        // Strict date check for recurringEndDate
        if (recurringEndDate && new Date(dateStr) > recurringEndDate) {
          break;
        }

        const isCompleted = completionMap.get(task.id)?.has(dateStr) ?? false;

        events.push({
          ...formattedTask,
          dueDate: instance,
          completed: isCompleted,
          instanceDate: dateStr
        });
      }
    } else if (pattern === 'weekly') {
      const current = new Date(Math.max(taskDueDate.getTime(), startDate.getTime()));
      current.setUTCHours(taskDueDate.getUTCHours(), taskDueDate.getUTCMinutes(), 0, 0);

      for (
        ;
        current.getTime() <= effectiveEndDate.getTime();
        current.setUTCDate(current.getUTCDate() + 1)
      ) {
        if (current >= startDate && current.getUTCDay() === taskDueDate.getUTCDay()) {
          const dateStr = current.toISOString().split('T')[0];

          if (recurringEndDate && new Date(dateStr) > recurringEndDate) {
            break;
          }

          const isCompleted = completionMap.get(task.id)?.has(dateStr) ?? false;

          events.push({
            ...formattedTask,
            dueDate: new Date(current),
            completed: isCompleted,
            instanceDate: dateStr
          });
        }
      }
    } else if (pattern === 'biweekly') {
      const current = new Date(Math.max(taskDueDate.getTime(), startDate.getTime()));
      current.setUTCHours(taskDueDate.getUTCHours(), taskDueDate.getUTCMinutes(), 0, 0);

      for (
        ;
        current.getTime() <= effectiveEndDate.getTime();
        current.setUTCDate(current.getUTCDate() + 1)
      ) {
        if (current >= startDate && current.getUTCDay() === taskDueDate.getUTCDay()) {
          const weeksDiff = Math.floor(
            (current.getTime() - taskDueDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
          );

          // Only include if it's an even number of weeks from the start
          if (weeksDiff % 2 === 0) {
            const dateStr = current.toISOString().split('T')[0];

            if (recurringEndDate && new Date(dateStr) > recurringEndDate) {
              break;
            }

            const isCompleted = completionMap.get(task.id)?.has(dateStr) ?? false;

            events.push({
              ...formattedTask,
              dueDate: new Date(current),
              completed: isCompleted,
              instanceDate: dateStr
            });
          }
        }
      }
    } else if (pattern === 'monthly') {
      const current = new Date(taskDueDate);
      current.setUTCHours(taskDueDate.getUTCHours(), taskDueDate.getUTCMinutes(), 0, 0);

      for (
        ;
        current.getTime() <= effectiveEndDate.getTime();
        current.setUTCMonth(current.getUTCMonth() + 1)
      ) {
        if (current >= startDate) {
          const dateStr = current.toISOString().split('T')[0];

          if (recurringEndDate && new Date(dateStr) > recurringEndDate) {
            break;
          }

          const isCompleted = completionMap.get(task.id)?.has(dateStr) ?? false;

          events.push({
            ...formattedTask,
            dueDate: new Date(current),
            completed: isCompleted,
            instanceDate: dateStr
          });
        }
      }
    } else if (pattern === 'end_of_month') {
      const current = new Date(taskDueDate);
      // Set to 1st of month to avoid overflow issues when iterating
      current.setUTCDate(1);
      current.setUTCHours(taskDueDate.getUTCHours(), taskDueDate.getUTCMinutes(), 0, 0);

      for (
        ;
        current.getTime() <= effectiveEndDate.getTime();
        current.setUTCMonth(current.getUTCMonth() + 1)
      ) {
        // Calculate last day of this current month in UTC
        // Date.UTC(year, month + 1, 0) gives the timestamp for 00:00 UTC on the last day of 'month'
        const lastDayTimestamp = Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0);
        const lastDay = new Date(lastDayTimestamp);

        lastDay.setUTCHours(taskDueDate.getUTCHours(), taskDueDate.getUTCMinutes(), 0, 0);

        if (lastDay >= startDate && lastDay <= effectiveEndDate) {
          const dateStr = lastDay.toISOString().split('T')[0];

          if (recurringEndDate && new Date(dateStr) > recurringEndDate) {
            break;
          }

          const isCompleted = completionMap.get(task.id)?.has(dateStr) ?? false;

          events.push({
            ...formattedTask,
            dueDate: new Date(lastDay),
            completed: isCompleted,
            instanceDate: dateStr
          });
        }
      }
    } else {
      if (taskDueDate >= startDate && taskDueDate <= endDate) {
        events.push({
          ...formattedTask,
          dueDate: task.dueDate,
          completed: task.columnName ? isColumnDone(task.columnName) : false
        });
      }
    }
  }

  return events;
}
