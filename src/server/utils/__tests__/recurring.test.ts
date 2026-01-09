import { describe, it, expect } from 'vitest';
import { expandRecurringTasks } from '../recurring';
import type { Task } from '../../../shared/types/board';

describe('expandRecurringTasks', () => {
  const baseTask: Task = {
    id: 't1',
    title: 'Recurring Task',
    description: '',
    columnId: 'c1',
    boardId: 'b1',
    userId: 'u1',
    space: 'work',
    priority: 'medium',
    createdAt: new Date('2025-01-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2025-01-01T10:00:00Z').toISOString(),
    columnName: 'To Do',
    boardName: 'Board',
    labels: [],
    subtasks: []
  };

  it('should expand daily tasks', () => {
    const task: Task = {
      ...baseTask,
      dueDate: new Date('2025-01-01T10:00:00Z').toISOString(), // Wednesday
      recurringPattern: 'daily'
    };

    // View range: Jan 1 to Jan 3
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-01-03T23:59:59Z');

    const events = expandRecurringTasks([task], start, end, new Map());

    expect(events.length).toBe(3);
    const dates = events.map((e) => e.instanceDate);
    expect(dates).toContain('2025-01-01');
    expect(dates).toContain('2025-01-02');
    expect(dates).toContain('2025-01-03');
  });

  it('should expand weekly tasks', () => {
    const task: Task = {
      ...baseTask,
      dueDate: new Date('2025-01-01T10:00:00Z').toISOString(), // Wednesday
      recurringPattern: 'weekly'
    };

    // View range: Jan 1 (Wed) to Jan 15 (Wed)
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-01-15T23:59:59Z');

    const events = expandRecurringTasks([task], start, end, new Map());

    // Should match Jan 1, Jan 8, Jan 15
    expect(events.length).toBe(3);
    const dates = events.map((e) => e.instanceDate);
    expect(dates).toContain('2025-01-01');
    expect(dates).toContain('2025-01-08');
    expect(dates).toContain('2025-01-15');
  });

  it('should expand biweekly tasks', () => {
    const task: Task = {
      ...baseTask,
      dueDate: new Date('2025-01-01T10:00:00Z').toISOString(), // Wednesday
      recurringPattern: 'biweekly'
    };

    // Jan 1 (Wed), Jan 8 (skip), Jan 15 (Wed), Jan 22 (skip), Jan 29 (Wed)
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-01-31T23:59:59Z');

    const events = expandRecurringTasks([task], start, end, new Map());

    expect(events.length).toBe(3);
    const dates = events.map((e) => e.instanceDate);
    expect(dates).toContain('2025-01-01');
    expect(dates).toContain('2025-01-15');
    expect(dates).toContain('2025-01-29');
  });

  it('should expand monthly tasks', () => {
    const task: Task = {
      ...baseTask,
      dueDate: new Date('2025-01-15T10:00:00Z').toISOString(),
      recurringPattern: 'monthly'
    };

    // Jan to March
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-03-31T23:59:59Z');

    const events = expandRecurringTasks([task], start, end, new Map());
    expect(events.length).toBe(3);
    const dates = events.map((e) => e.instanceDate);
    expect(dates).toContain('2025-01-15');
    expect(dates).toContain('2025-02-15');
    expect(dates).toContain('2025-03-15');
  });

  it('should expand end_of_month tasks', () => {
    const task: Task = {
      ...baseTask,
      dueDate: new Date('2025-01-31T10:00:00Z').toISOString(),
      recurringPattern: 'end_of_month'
    };

    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-02-28T23:59:59Z'); // Feb 2025 is 28 days

    const events = expandRecurringTasks([task], start, end, new Map());

    expect(events.length).toBe(2);
    const dates = events.map((e) => e.instanceDate);
    expect(dates).toContain('2025-01-31');
    expect(dates).toContain('2025-02-28');
  });

  it('should handle tasks without dueDate using createdAt', () => {
    const task: Task = {
      ...baseTask,
      dueDate: null,
      createdAt: new Date('2025-01-05T10:00:00Z').toISOString(),
      recurringPattern: 'daily'
    };

    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-01-07T23:59:59Z');

    const events = expandRecurringTasks([task], start, end, new Map());
    // Should start from Jan 5
    expect(events.length).toBe(3); // 5, 6, 7
    expect(events.map((e) => e.instanceDate)).toEqual(['2025-01-05', '2025-01-06', '2025-01-07']);
  });

  it('should respect recurringEndDate', () => {
    const task: Task = {
      ...baseTask,
      dueDate: new Date('2025-01-01T10:00:00Z').toISOString(),
      recurringPattern: 'daily',
      recurringEndDate: new Date('2025-01-02T23:59:59Z').toISOString()
    };

    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-01-05T23:59:59Z');

    const events = expandRecurringTasks([task], start, end, new Map());
    expect(events.length).toBe(2); // Jan 1, Jan 2 only
  });

  it('should skip tasks outside range', () => {
    const task: Task = {
      ...baseTask,
      dueDate: new Date('2025-01-10T10:00:00Z').toISOString(),
      recurringPattern: null
    };

    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-01-05T23:59:59Z');

    const events = expandRecurringTasks([task], start, end, new Map());
    expect(events.length).toBe(0);
  });
});
