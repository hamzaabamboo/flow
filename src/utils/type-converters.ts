import type { CalendarEvent, ExtendedTask } from '../shared/types/calendar';

export function calendarEventToExtendedTask(event: CalendarEvent): ExtendedTask {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    dueDate: event.dueDate ? new Date(event.dueDate).toISOString() : undefined,
    priority: (event.priority as ExtendedTask['priority']) || undefined,
    completed: event.completed || false,
    columnId: event.columnId || '',
    columnName: '',
    boardName: '',
    boardId: '',
    boardSpace: event.space || 'personal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    labels: event.labels,
    subtasks: event.subtasks,
    recurringPattern: event.recurringPattern,
    recurringEndDate: event.recurringEndDate
  };
}
