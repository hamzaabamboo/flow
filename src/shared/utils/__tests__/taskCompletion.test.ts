import { describe, it, expect } from 'vitest';
import { isColumnDone, isTaskCompleted } from '../taskCompletion';

describe('shared taskCompletion utils', () => {
  it('isColumnDone should return true for "Done" (case insensitive)', () => {
    expect(isColumnDone('Done')).toBe(true);
    expect(isColumnDone('done')).toBe(true);
  });

  it('isTaskCompleted should return completed flag for recurring task instances', () => {
    const recurringTask = {
      instanceDate: '2024-01-01',
      completed: true,
      recurringPattern: 'daily',
      columnName: 'To Do' // Should be ignored in favor of completed flag
    };
    expect(isTaskCompleted(recurringTask)).toBe(true);

    const recurringTaskIncomplete = {
      ...recurringTask,
      completed: false
    };
    expect(isTaskCompleted(recurringTaskIncomplete)).toBe(false);
  });

  it('isTaskCompleted should check column name for regular tasks', () => {
    expect(isTaskCompleted({ columnName: 'Done' })).toBe(true);
    expect(isTaskCompleted({ columnName: 'To Do' })).toBe(false);
    expect(isTaskCompleted({ columnName: null })).toBe(false);
  });
});
