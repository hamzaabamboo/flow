import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { ReminderSyncService } from '../reminder-sync';
import { db } from '../../db';

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
    (mockDb.query.columns.findFirst as Mock).mockResolvedValue({
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

    await service.syncReminders(mockOptions);

    expect(mockDelete).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
    // Should create 2 reminders (15 min before + at due time which is also 15 min if not specified?
    // Wait, the code says:
    // Second reminder: At due time (or use custom minutesBefore if specified)
    // if (minutesBefore !== 15) { secondReminderTime.setMinutes(...) }
    // Since minutesBefore is 15, secondReminderTime remains same as dueDate.

    const createdValues = mockValues.mock.calls[0][0];
    expect(createdValues.length).toBe(2);
  });

  it('should not create reminders if task is in "Done" column', async () => {
    (mockDb.query.columns.findFirst as Mock).mockResolvedValue({
      id: 'c1',
      name: 'Done',
      board: { id: 'b1', settings: {} }
    });

    await service.syncReminders(mockOptions);

    expect(mockDelete).toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('should not create reminders if due date is in the past', async () => {
    (mockDb.query.columns.findFirst as Mock).mockResolvedValue({
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
    (mockDb.query.columns.findFirst as Mock).mockResolvedValue({
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
    // It should contain a reminder for the due time (message "due now")
    expect(createdValues.some((r: { message: string }) => r.message.includes('due now'))).toBe(
      true
    );
  });

  it('getReminderSettings should return defaults if no board settings', async () => {
    (mockDb.query.columns.findFirst as Mock).mockResolvedValue({
      id: 'c1',
      board: { settings: null }
    });

    const settings = await service.getReminderSettings('c1');
    expect(settings.enableAutoReminders).toBe(true);
    expect(settings.reminderMinutesBefore).toBe(15);
  });
});
