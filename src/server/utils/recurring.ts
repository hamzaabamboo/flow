import type { Task } from '../../shared/types/board';

export function expandRecurringTasks(
  tasks: Task[],
  startDate: Date,
  endDate: Date,
  completionMap: Map<string, Set<string>>
) {
  const events = [];

  for (const task of tasks) {
    if (!task.dueDate) continue;

    const taskDueDate = new Date(task.dueDate);

    const formattedTask = {
      ...task,
      space: task.space,
      type: 'task' as const
    };

    if (!task.recurringPattern) {
      // Compare using date strings to avoid timezone issues
      const taskDateStr = taskDueDate.toISOString().split('T')[0];
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      if (taskDateStr >= startDateStr && taskDateStr <= endDateStr) {
        const isCompleted = task.completed || (completionMap.get(task.id)?.has(taskDateStr) ?? false);

        events.push({
          ...formattedTask,
          completed: isCompleted,
          instanceDate: taskDateStr
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
