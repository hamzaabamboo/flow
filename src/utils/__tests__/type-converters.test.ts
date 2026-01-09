import { describe, it, expect } from 'vitest';
import { calendarEventToExtendedTask } from '../type-converters';

describe('type-converters', () => {
  it('calendarEventToExtendedTask should convert correctly', () => {
    const event: any = {
      id: 'e1',
      title: 'Title',
      description: 'Desc',
      dueDate: '2024-01-01T10:00:00Z',
      priority: 'high',
      columnId: 'c1',
      columnName: 'To Do',
      boardName: 'Board',
      boardId: 'b1',
      space: 'personal',
      labels: ['l1'],
      subtasks: []
    };

    const task = calendarEventToExtendedTask(event);

    expect(task.id).toBe('e1');
    expect(task.title).toBe('Title');
    expect(task.dueDate).toBe('2024-01-01T10:00:00.000Z');
    expect(task.priority).toBe('high');
    expect(task.columnId).toBe('c1');
    expect(task.boardSpace).toBe('personal');
    expect(task.labels).toEqual(['l1']);
  });

  it('should handle missing optional fields', () => {
    const event: any = {
      id: 'e1',
      title: 'Title'
    };

    const task = calendarEventToExtendedTask(event);

    expect(task.id).toBe('e1');
    expect(task.columnId).toBe('');
    expect(task.boardSpace).toBe('personal');
  });
});
