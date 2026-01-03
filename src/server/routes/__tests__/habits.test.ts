import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Elysia } from 'elysia';

// --- MOCKS ---

const createMockQueryBuilder = (resolvedValue: any) => {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(resolvedValue), // For insert/update returning
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),

    // oxlint-disable-next-line unicorn/no-thenable
    then: (resolve: any) => Promise.resolve(resolvedValue).then(resolve)
  };
};

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    values: vi.fn(),
    set: vi.fn(),
    returning: vi.fn()
  }
}));

vi.mock('../../auth/withAuth', () => ({
  withAuth: () => (app: any) =>
    app
      .decorate('user', { id: 'user-1', email: 'test@example.com' })
      .derive(() => ({ user: { id: 'user-1', email: 'test@example.com' } }))
}));

import { habitsRoutes } from '../habits';
import { db } from '../../db';

describe('Habit Routes', () => {
  let app: unknown;

  beforeEach(() => {
    vi.resetAllMocks();

    // Default mocks
    (db as any).select.mockReturnValue(createMockQueryBuilder([]));
    (db as any).insert.mockReturnValue(createMockQueryBuilder([]));
    (db as any).update.mockReturnValue(createMockQueryBuilder([]));

    app = new Elysia().decorate('db', db).use(habitsRoutes);
  });

  describe('GET /habits', () => {
    it('should list user habits', async () => {
      const mockHabits = [
        { id: 'h1', name: 'Exercise', active: true, userId: 'user-1', frequency: 'daily' }
      ];
      (db.select as any).mockReturnValue(createMockQueryBuilder(mockHabits));

      const response = await (app as any).handle(new Request('http://localhost/habits'));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Exercise');
    });

    it('should filter habits by date (active=true)', async () => {
      (db.select as any).mockReturnValue(createMockQueryBuilder([]));

      await (app as any).handle(new Request('http://localhost/habits?date=2024-01-01'));

      expect(db.select).toHaveBeenCalled();
    });

    it('should support week view', async () => {
      const mockHabits = [
        { id: 'h1', name: 'Daily', frequency: 'daily', active: true, userId: 'user-1' },
        {
          id: 'h2',
          name: 'Weekly Monday',
          frequency: 'weekly',
          targetDays: [1],
          active: true,
          userId: 'user-1'
        } // 1 = Monday
      ];

      // Mock fetch habits
      (db.select as any).mockReturnValueOnce(createMockQueryBuilder(mockHabits));
      // Mock fetch logs (empty for now)
      (db.select as any).mockReturnValueOnce(createMockQueryBuilder([]));

      // query date 2024-01-01 is a Monday
      const response = await (app as any).handle(
        new Request('http://localhost/habits?view=week&date=2024-01-01')
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      // Should return flattened list of occurrences for the week
      expect(Array.isArray(data)).toBe(true);

      // Verify Monday (2024-01-01) has both habits
      const mondayItems = data.filter((d: any) => d.checkDate === '2024-01-01');
      expect(mondayItems).toHaveLength(2); // Daily + Monday Weekly

      // Verify Tuesday (2024-01-02) has only daily
      const tuesdayItems = data.filter((d: any) => d.checkDate === '2024-01-02');
      expect(tuesdayItems).toHaveLength(1); // Daily only
    });

    it('should filter habits correctly in day view', async () => {
      const mockHabits = [
        { id: 'h1', name: 'Daily', frequency: 'daily', active: true },
        { id: 'h2', name: 'Weekly Monday', frequency: 'weekly', targetDays: [1], active: true }
      ];

      // 1. Test Monday (Match)
      (db.select as any).mockReturnValueOnce(createMockQueryBuilder(mockHabits)); // Habits
      (db.select as any).mockReturnValueOnce(createMockQueryBuilder([])); // Logs

      const resMonday = await (app as any).handle(
        new Request('http://localhost/habits?view=day&date=2024-01-01') // Monday
      );
      const dataMonday = await resMonday.json();
      expect(dataMonday).toHaveLength(2);

      // 2. Test Tuesday (No Match for h2)
      (db.select as any).mockReturnValueOnce(createMockQueryBuilder(mockHabits)); // Habits
      (db.select as any).mockReturnValueOnce(createMockQueryBuilder([])); // Logs

      const resTuesday = await (app as any).handle(
        new Request('http://localhost/habits?view=day&date=2024-01-02') // Tuesday
      );
      const dataTuesday = await resTuesday.json();
      expect(dataTuesday).toHaveLength(1);
      expect(dataTuesday[0].id).toBe('h1');
    });
  });

  describe('POST /habits', () => {
    it('should create a new habit', async () => {
      const newHabitIn = {
        name: 'Read',
        frequency: 'daily',
        space: 'personal'
      };
      const newHabitOut = { ...newHabitIn, id: 'h2', userId: 'user-1' };

      (db.insert as any).mockReturnValue(createMockQueryBuilder([newHabitOut]));

      const response = await (app as any).handle(
        new Request('http://localhost/habits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newHabitIn)
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.id).toBe('h2');
    });
  });

  describe('PATCH /habits/:id', () => {
    it('should update habit fields', async () => {
      const updatePayload = { name: 'Read Book' };

      // Mock getting current habit
      (db.select as any).mockReturnValueOnce(
        createMockQueryBuilder([{ id: 'h1', userId: 'user-1', active: true }])
      );
      // Mock update return
      (db.update as any).mockReturnValueOnce(
        createMockQueryBuilder([{ id: 'h1', name: 'Read Book' }])
      );

      const response = await (app as any).handle(
        new Request('http://localhost/habits/h1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.name).toBe('Read Book');
    });
  });

  describe('DELETE /habits/:id', () => {
    it('should soft delete habit (set active=false)', async () => {
      (db.update as any).mockReturnValue(createMockQueryBuilder([]));

      const response = await (app as any).handle(
        new Request('http://localhost/habits/h1', { method: 'DELETE' })
      );

      expect(response.status).toBe(200);
    });
  });

  describe('POST /habits/:id/log', () => {
    it('should log a habit completion', async () => {
      const logData = { date: '2024-01-01', completed: true };

      // 1. Check existing log (empty)
      (db.select as any).mockReturnValueOnce(createMockQueryBuilder([]));
      // 2. Insert new log
      (db.insert as any).mockReturnValueOnce(
        createMockQueryBuilder([{ id: 'l1', completed: true }])
      );

      const response = await (app as any).handle(
        new Request('http://localhost/habits/h1/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logData)
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.completed).toBe(true);
    });

    it('should update existing log', async () => {
      const logData = { date: '2024-01-01', completed: false };

      // 1. Check existing log (found)
      (db.select as any).mockReturnValueOnce(
        createMockQueryBuilder([{ id: 'l1', completed: true }])
      );
      // 2. Update log
      (db.update as any).mockReturnValueOnce(
        createMockQueryBuilder([{ id: 'l1', completed: false }])
      );

      const response = await (app as any).handle(
        new Request('http://localhost/habits/h1/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logData)
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.completed).toBe(false);
    });
  });

  describe('GET /habits/:id/stats', () => {
    it('should calculate stats', async () => {
      const mockHabit = {
        id: 'h1',
        name: 'Run',
        frequency: 'daily',
        userId: 'user-1',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
      };

      // 1. Get Habit
      (db.select as any).mockReturnValueOnce(createMockQueryBuilder([mockHabit]));
      // 2. Get Completion Count
      (db.select as any).mockReturnValueOnce(createMockQueryBuilder([{ count: 5 }]));

      const response = await (app as any).handle(new Request('http://localhost/habits/h1/stats'));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.totalCompletions).toBe(5);
      expect(data.expectedOccurrences).toBeGreaterThan(0);
    });
  });
  it('should calculate stats including complex weekly frequency', async () => {
    // Create a habit created 15 days ago
    // If today is Monday. 15 days ago = Sunday 2 weeks ago.
    // Range: 15 days.
    // Frequency: Weekly on Monday (1) and Wednesday (3).
    // Occurrences should be calculated correctly.

    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() - 15);

    const mockHabit = {
      id: 'h2',
      name: 'Gym',
      frequency: 'weekly',
      targetDays: [1, 3], // Mon, Wed
      userId: 'user-1',
      createdAt: createdDate
    };

    (db.select as any).mockReturnValueOnce(createMockQueryBuilder([mockHabit]));
    (db.select as any).mockReturnValueOnce(createMockQueryBuilder([{ count: 2 }])); // 2 completions

    const response = await (app as any).handle(new Request('http://localhost/habits/h2/stats'));

    const data = await response.json();
    expect(response.status).toBe(200);
    // Just verify it runs the logic without error and returns a number
    expect(typeof data.expectedOccurrences).toBe('number');
    expect(data.completionRate).toBeGreaterThanOrEqual(0);
  });

  describe('GET /habits?view=week (Advanced)', () => {
    it('should map completions correctly to days', async () => {
      // Mock Monday Jan 1 2024
      const mondayStr = '2024-01-01';

      const mockHabit = {
        id: 'h1',
        name: 'Daily',
        frequency: 'daily',
        active: true,
        userId: 'user-1'
      };
      // Log for Monday only
      const mockLog = {
        id: 'l1',
        habitId: 'h1',
        date: new Date('2024-01-01T00:00:00.000Z'),
        completed: true
      };

      (db.select as any).mockReturnValueOnce(createMockQueryBuilder([mockHabit])); // Habits
      (db.select as any).mockReturnValueOnce(createMockQueryBuilder([mockLog])); // Logs

      const response = await (app as any).handle(
        new Request(`http://localhost/habits?view=week&date=${mondayStr}`)
      );

      const data = await response.json();
      expect(response.status).toBe(200);

      // Monday Item (2024-01-01) -> completedToday should be TRUE
      const mondayItem = data.find((d: any) => d.checkDate === '2024-01-01');
      expect(mondayItem).toBeDefined();
      expect(mondayItem.completedToday).toBe(true);

      // Tuesday Item (2024-01-02) -> completedToday should be FALSE
      const tuesdayItem = data.find((d: any) => d.checkDate === '2024-01-02');
      expect(tuesdayItem).toBeDefined();
      expect(tuesdayItem.completedToday).toBe(false);
    });
  });
});
