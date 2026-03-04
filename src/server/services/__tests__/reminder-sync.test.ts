import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReminderSyncService } from '../reminder-sync';
import { db } from '../../db';
import { asMock } from '../../../test/mocks/api';

// Mock DB module
const mockDelete = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockReturnThis();
const mockValues = vi.fn().mockReturnThis();

const mockDb = {
  delete: mockDelete,
  where: mockWhere,
  insert: mockInsert,
  values: mockValues,
  query: {
    columns: {
      findFirst: vi.fn()
    }
  }
} as unknown as typeof db;

describe('ReminderSyncService', () => {
  let service: ReminderSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReminderSyncService(mockDb);
  });

  const mockOptions = {
    userId: 'u1',
    taskId: 't1',
    taskTitle: 'Test Task',
    columnId: 'c1',
    dueDate: new Date(Date.now() + 3600000) // 1 hour from now
  };

  it('should delete existing reminders and create new ones', async () => {
    // Mock column/board state
    asMock(mockDb.query.columns.findFirst).mockResolvedValue({
      id: 'c1',
      name: 'To Do',
      board: {
        id: 'b1',
        settings: {
          enableAutoReminders: true,
          reminderMinutesBefore: 15
        }
      }
    });

    const futureDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    await service.syncReminders({
      ...mockOptions,
      dueDate: futureDueDate
    });

    expect(mockDelete).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();

    const createdValues = mockValues.mock.calls[0][0];
    expect(createdValues.length).toBe(6);
    expect(createdValues.some((r: { message: string }) => r.message.includes('1 day'))).toBe(true);
    expect(createdValues.some((r: { message: string }) => r.message.includes('6 hours'))).toBe(
      true
    );
    expect(createdValues.some((r: { message: string }) => r.message.includes('3 hours'))).toBe(
      true
    );
    expect(createdValues.some((r: { message: string }) => r.message.includes('1 hour'))).toBe(true);
  });

  it('should not create reminders if task is in a semantic completion column', async () => {
    asMock(mockDb.query.columns.findFirst).mockResolvedValue({
      id: 'c1',
      name: 'Completed',
      board: { id: 'b1', settings: {} }
    });

    await service.syncReminders(mockOptions);

    expect(mockDelete).toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('should not create reminders if due date is in the past', async () => {
    asMock(mockDb.query.columns.findFirst).mockResolvedValue({
      id: 'c1',
      name: 'To Do',
      board: { id: 'b1', settings: {} }
    });

    await service.syncReminders({
      ...mockOptions,
      dueDate: new Date(Date.now() - 3600000) // 1 hour ago
    });

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('should create an immediate reminder if task is due very soon', async () => {
    asMock(mockDb.query.columns.findFirst).mockResolvedValue({
      id: 'c1',
      name: 'To Do',
      board: { id: 'b1', settings: {} }
    });

    // Due in 5 minutes
    const dueDate = new Date(Date.now() + 300000);
    await service.syncReminders({
      ...mockOptions,
      dueDate
    });

    expect(mockInsert).toHaveBeenCalled();
    const createdValues = mockValues.mock.calls[0][0];
    expect(
      createdValues.some((r: { message: string }) => r.message.includes('due at deadline'))
    ).toBe(true);
  });

  it('getReminderSettings should return defaults if no board settings', async () => {
    asMock(mockDb.query.columns.findFirst).mockResolvedValue({
      id: 'c1',
      board: { settings: null }
    });

    const settings = await service.getReminderSettings('c1');
    expect(settings.enableAutoReminders).toBe(true);
    expect(settings.reminderMinutesBefore).toBe(15);
  });
});
