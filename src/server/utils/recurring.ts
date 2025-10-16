import type { Task } from '../../shared/types/board';

export function expandRecurringTasks(
  tasks: Task[],
  startDate: Date,
  endDate: Date,
  completionMap: Map<string, Set<string>>
) {
  const events = [];

  for (const task of tasks) {
    // For non-recurring tasks, skip if no dueDate
    if (!task.dueDate && !task.recurringPattern) continue;

    // For recurring tasks without dueDate, use createdAt or startDate as the start
    const taskDueDate = task.dueDate
      ? new Date(task.dueDate)
      : task.createdAt
        ? new Date(task.createdAt)
        : new Date(startDate);

    const formattedTask = {
      ...task,
      space: task.space,
      type: 'task' as const
    };

    if (!task.recurringPattern) {
      // Simple UNIX timestamp comparison - no timezone bullshit
      if (taskDueDate >= startDate && taskDueDate <= endDate) {
        // Non-recurring tasks don't have a completed field - use columnName instead
        events.push({
          ...formattedTask
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
      startDay.setHours(0, 0, 0, 0);

      const taskStartDay = new Date(taskDueDate);
      taskStartDay.setHours(0, 0, 0, 0);

      const currentDay = taskStartDay < startDay ? new Date(startDay) : new Date(taskStartDay);
      currentDay.setHours(0, 0, 0, 0);

      while (currentDay <= effectiveEndDate) {
        const instance = new Date(currentDay);
        instance.setHours(taskDueDate.getHours(), taskDueDate.getMinutes(), 0, 0);

        const dateStr = instance.toISOString().split('T')[0];
        const isCompleted = completionMap.get(task.id)?.has(dateStr) ?? false;

        events.push({
          ...formattedTask,
          dueDate: instance,
          completed: isCompleted,
          instanceDate: dateStr
        });

        currentDay.setDate(currentDay.getDate() + 1);
      }
    } else if (pattern === 'weekly') {
      const current = new Date(Math.max(taskDueDate.getTime(), startDate.getTime()));
      current.setHours(taskDueDate.getHours(), taskDueDate.getMinutes(), 0, 0);

      while (current <= effectiveEndDate) {
        if (current >= startDate && current.getDay() === taskDueDate.getDay()) {
          const dateStr = current.toISOString().split('T')[0];
          const isCompleted = completionMap.get(task.id)?.has(dateStr) ?? false;

          events.push({
            ...formattedTask,
            dueDate: new Date(current),
            completed: isCompleted,
            instanceDate: dateStr
          });
        }
        current.setDate(current.getDate() + 1);
      }
    } else if (pattern === 'biweekly') {
      const current = new Date(Math.max(taskDueDate.getTime(), startDate.getTime()));
      current.setHours(taskDueDate.getHours(), taskDueDate.getMinutes(), 0, 0);

      while (current <= effectiveEndDate) {
        if (current >= startDate && current.getDay() === taskDueDate.getDay()) {
          const weeksDiff = Math.floor(
            (current.getTime() - taskDueDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
          );

          // Only include if it's an even number of weeks from the start
          if (weeksDiff % 2 === 0) {
            const dateStr = current.toISOString().split('T')[0];
            const isCompleted = completionMap.get(task.id)?.has(dateStr) ?? false;

            events.push({
              ...formattedTask,
              dueDate: new Date(current),
              completed: isCompleted,
              instanceDate: dateStr
            });
          }
        }
        current.setDate(current.getDate() + 1);
      }
    } else if (pattern === 'monthly') {
      const current = new Date(taskDueDate);
      current.setHours(taskDueDate.getHours(), taskDueDate.getMinutes(), 0, 0);

      while (current <= effectiveEndDate) {
        if (current >= startDate) {
          const dateStr = current.toISOString().split('T')[0];
          const isCompleted = completionMap.get(task.id)?.has(dateStr) ?? false;

          events.push({
            ...formattedTask,
            dueDate: new Date(current),
            completed: isCompleted,
            instanceDate: dateStr
          });
        }
        current.setMonth(current.getMonth() + 1);
      }
    } else if (pattern === 'end_of_month') {
      const current = new Date(taskDueDate);
      current.setHours(taskDueDate.getHours(), taskDueDate.getMinutes(), 0, 0);

      while (current <= effectiveEndDate) {
        if (current >= startDate) {
          // Set to last day of the month
          const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0);
          lastDay.setHours(taskDueDate.getHours(), taskDueDate.getMinutes(), 0, 0);

          if (lastDay >= startDate && lastDay <= effectiveEndDate) {
            const dateStr = lastDay.toISOString().split('T')[0];
            const isCompleted = completionMap.get(task.id)?.has(dateStr) ?? false;

            events.push({
              ...formattedTask,
              dueDate: new Date(lastDay),
              completed: isCompleted,
              instanceDate: dateStr
            });
          }
        }
        current.setMonth(current.getMonth() + 1);
      }
    } else {
      if (taskDueDate >= startDate && taskDueDate <= endDate) {
        events.push({
          ...formattedTask,
          dueDate: task.dueDate
        });
      }
    }
  }

  return events;
}
