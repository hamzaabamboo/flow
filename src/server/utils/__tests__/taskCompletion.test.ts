import { describe, it, expect } from 'vitest';
import { isColumnDone, isTaskCompleted } from '../taskCompletion';

describe('taskCompletion utils', () => {
  it('isColumnDone should return true for semantic completion columns', () => {
    expect(isColumnDone('Done')).toBe(true);
    expect(isColumnDone('done')).toBe(true);
    expect(isColumnDone('DONE')).toBe(true);
    expect(isColumnDone('Completed')).toBe(true);
    expect(isColumnDone('completed')).toBe(true);
  });

  it('isColumnDone should return false for other names', () => {
    expect(isColumnDone('To Do')).toBe(false);
    expect(isColumnDone('In Progress')).toBe(false);
  });

  it('isTaskCompleted should return true for semantic completion columns', () => {
    expect(isTaskCompleted('Done')).toBe(true);
    expect(isTaskCompleted('Completed')).toBe(true);
  });

  it('isTaskCompleted should return false for null or other names', () => {
    expect(isTaskCompleted(null)).toBe(false);
    expect(isTaskCompleted(undefined)).toBe(false);
    expect(isTaskCompleted('To Do')).toBe(false);
  });
});
