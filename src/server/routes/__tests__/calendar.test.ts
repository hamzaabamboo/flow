import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Elysia } from 'elysia';
import { PgSelectBuilder } from 'drizzle-orm/pg-core';

// --- MOCKS ---

// 1. Mock DB and Drizzle
const createMockQueryBuilder = (resolvedValue: unknown) => {
  const builder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),

    // oxlint-disable-next-line unicorn/no-thenable
    then: (resolve: (val: unknown) => void) => Promise.resolve(resolvedValue).then(resolve)
  };
  return builder as unknown as PgSelectBuilder<any, any>;
};

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    leftJoin: vi.fn(),
    transaction: vi.fn((cb) =>
      cb({
        /* mock tx */
      })
    )
  }
}));

// 2. Mock Auth
vi.mock('../../auth/withAuth', () => ({
  withAuth: () => (app: Elysia) =>
    app
      .decorate('user', { id: 'user-1', email: 'test@example.com' })
      .derive(() => ({ user: { id: 'user-1', email: 'test@example.com' } }))
}));

// 3. Mock Utilities
vi.mock('../../utils/recurring', () => ({
  expandRecurringTasks: vi.fn((tasks) => tasks) // Pass through by default
}));

vi.mock('../../utils/ical-parser', () => ({
  fetchAndParseIcal: vi.fn(),
  convertIcalToEvents: vi.fn().mockReturnValue([])
}));

process.env.CALENDAR_SECRET = 'test-secret';

import { publicCalendarRoutes, calendarRoutes } from '../calendar';
import { db } from '../../db';
import { expandRecurringTasks } from '../../utils/recurring';
import { fetchAndParseIcal, convertIcalToEvents } from '../../utils/ical-parser';

describe('Calendar Routes', () => {
  let app: { handle: (request: Request) => Promise<Response> };
  // removed unused mockUser

  beforeEach(() => {
    vi.resetAllMocks();

    // Default mocks
    (db.select as Mock).mockReturnValue(createMockQueryBuilder([]));

    app = new Elysia().use(publicCalendarRoutes).use(calendarRoutes);
  });

  describe('GET /api/calendar/ical/:userId/:token', () => {
    it('should return 401 for invalid token', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/calendar/ical/user-1/bad-token')
      );
      expect(response.status).toBe(401);
    });

    it('should generate iCal file for valid token', async () => {
      const { createHash } = await import('crypto');
      const validToken = createHash('sha256').update(`user-1-test-secret`).digest('hex');

      const mockTasks = [
        { id: 't1', title: 'Task 1', dueDate: new Date().toISOString(), userId: 'user-1' }
      ];
      const mockSelect = db.select as Mock;
      mockSelect.mockReturnValueOnce(createMockQueryBuilder(mockTasks));
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // No habits

      const response = await app.handle(
        new Request(`http://localhost/api/calendar/ical/user-1/${validToken}`)
      );

      expect(response.status).toBe(200);
      // expect(response.headers.get('Content-Type')).toContain('text/calendar');
      const text = await response.text();
      expect(text).toContain('BEGIN:VCALENDAR');
      expect(text).toContain('Task 1');
    });
  });

  describe('GET /calendar/feed-url', () => {
    it('should return subscription URL', async () => {
      const response = await app.handle(new Request('http://localhost/calendar/feed-url'));
      const data = await response.json();
      expect(data.url).toContain('/api/calendar/ical/user-1/');
    });
  });

  describe('GET /calendar/events', () => {
    const start = 1704067200; // 2024-01-01
    const end = 1706745600; // 2024-02-01

    it('should fetch events within date range', async () => {
      const mockTask = {
        id: 't1',
        title: 'Event 1',
        dueDate: new Date('2024-01-15'),
        userId: 'user-1'
      };

      // Sequence: Main -> Recurring -> Subtasks -> Completions -> External
      const mockSelect = db.select as Mock;
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockTask])); // Main
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Recurring
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Subtasks
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Completions
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // External

      const response = await app.handle(
        new Request(`http://localhost/calendar/events?start=${start}&end=${end}`)
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('t1');
    });

    it('should include upcoming recurring tasks', async () => {
      // Mock recurring task
      const recurringTask = {
        id: 'rec-1',
        title: 'Weekly Meeting',
        recurringPattern: 'weekly',
        userId: 'user-1'
      };

      // Expanded instance
      const expandedInstance = {
        id: 'rec-1',
        title: 'Daily Task',
        dueDate: new Date((end + 86400) * 1000), // 1 day after END
        type: 'task',
        completed: false
      };

      // 1. Main window call (empty)
      // 2. Upcoming window call (should find the instance)
      (expandRecurringTasks as Mock).mockReturnValueOnce([]); // Main
      // The Upcoming logic calls expandRecurringTasks.
      (expandRecurringTasks as Mock).mockReturnValueOnce([expandedInstance]); // Upcoming

      // Sequence calls...
      const mockSelect = db.select as Mock;
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Main
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Recurring (Main Window)
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Completions
      // Upcoming Logic:
      // 1. Upcoming Non-Recurring
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));
      // 2. Upcoming Recurring (THIS must return the task!)
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([recurringTask]));
      // External
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const response = await app.handle(
        new Request(
          `http://localhost/calendar/events?start=${start}&end=${end}&includeUpcoming=true`
        )
      );

      const data = await response.json();
      expect(data).toHaveLength(1);
      expect(expandRecurringTasks).toHaveBeenCalled();
    });

    it('should include overdue tasks if requested', async () => {
      const overdueTask = {
        id: 'ov-1',
        title: 'Overdue',
        dueDate: new Date(1000 * 1000), // Past
        userId: 'user-1',
        columnName: 'To Do',
        space: 'work'
      };

      // Sequence: Main -> Recurring -> [SKIP Subtasks] -> Completions -> Overdue -> External
      // Subtasks skipped because Main & Recurring are empty
      const mockSelect = db.select as Mock;
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Main
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Recurring
      // Subtasks SKIPPED
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Completions
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([overdueTask])); // Overdue
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // External

      const response = await app.handle(
        new Request(
          `http://localhost/calendar/events?start=${start}&end=${end}&includeOverdue=true`
        )
      );

      const data = await response.json();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('ov-1');
    });

    it('should include no-due-date tasks if requested', async () => {
      const nodateTask = { id: 'nd-1', title: 'No Date', dueDate: null, userId: 'user-1' };

      // Sequence: Main -> Recurring -> NoDueDate -> Subtasks -> Completions -> External
      const mockSelect = db.select as Mock;
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Main
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Recurring
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([nodateTask])); // No Due Date
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Subtasks
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Completions
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // External

      const response = await app.handle(
        new Request(
          `http://localhost/calendar/events?start=${start}&end=${end}&includeNoDueDate=true`
        )
      );

      const data = await response.json();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('nd-1');
    });

    it('should fetch external calendar events', async () => {
      const mockExtCal = {
        id: 'ext-1',
        icalUrl: 'http://example.com/cal.ics',
        userId: 'user-1',
        enabled: true
      };
      const mockEvent = { id: 'ext-evt-1', title: 'External Event', dueDate: new Date() };

      // Sequence: Main -> Recurring -> [SKIP Subtasks] -> Completions -> External (Found!)
      const mockSelect = db.select as Mock;
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Main
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Recurring
      // Subtasks SKIPPED because tasks array is empty
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Completions
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockExtCal])); // External query returns calendar config

      // Mock parser result using top-level mocks
      (fetchAndParseIcal as Mock).mockResolvedValue({});
      (convertIcalToEvents as Mock).mockReturnValue([mockEvent]);

      const response = await app.handle(
        new Request(`http://localhost/calendar/events?start=${start}&end=${end}`)
      );

      const data = await response.json();
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe('External Event');
    });

    it('should handle external calendar errors gracefully', async () => {
      const mockExtCal = {
        id: 'ext-err',
        icalUrl: 'http://fail.com',
        userId: 'user-1',
        enabled: true
      };

      const mockSelect = db.select as Mock;
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Main
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Recurring
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Completions
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockExtCal])); // External

      // Mock failure
      (fetchAndParseIcal as Mock).mockRejectedValue(new Error('Network Fail'));

      const response = await app.handle(
        new Request(`http://localhost/calendar/events?start=${start}&end=${end}`)
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveLength(0); // Should return empty list, not crash
    });

    it('should include overdue recurring tasks', async () => {
      const recurringTask = {
        id: 'rec-overdue',
        title: 'Daily Standup',
        recurringPattern: 'daily',
        userId: 'user-1'
      };
      // Past instance
      const expandedInstance = {
        id: 'rec-overdue',
        title: 'Daily Standup',
        dueDate: new Date((start - 86400) * 1000), // 1 day before start
        type: 'task',
        completed: false
      };

      // Sequence calls...
      const mockSelect = db.select as Mock;
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Main
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Recurring
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Completions
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([recurringTask])); // Overdue
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Overdue Completions
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // External

      // Mock expansion
      (expandRecurringTasks as Mock).mockReturnValueOnce([]); // Main
      (expandRecurringTasks as Mock).mockReturnValueOnce([expandedInstance]); // Overdue

      const response = await app.handle(
        new Request(
          `http://localhost/calendar/events?start=${start}&end=${end}&includeOverdue=true`
        )
      );

      const data = await response.json();
      expect(data).toHaveLength(1);
    });

    it('should sort events by date', async () => {
      const task1 = { id: 't1', dueDate: new Date('2024-01-02') };
      const task2 = { id: 't2', dueDate: new Date('2024-01-01') };

      const mockSelect = db.select as Mock;
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([task1, task2])); // Main returns unordered
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Recurring
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Subtasks
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // Completions
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([])); // External

      const response = await app.handle(
        new Request(`http://localhost/calendar/events?start=${start}&end=${end}`)
      );

      const data = await response.json();
      expect(data[0].id).toBe('t2'); // 01-01
      expect(data[1].id).toBe('t1'); // 01-02
    });
  });

  describe('iCal Generation Details', () => {
    it('should handle all recurring patterns', async () => {
      const { createHash } = await import('crypto');
      const token = createHash('sha256').update(`user-1-test-secret`).digest('hex');

      const tasksPatterns = [
        {
          id: 'p1',
          title: 'Daily',
          recurringPattern: 'daily',
          dueDate: new Date().toISOString(),
          userId: 'user-1'
        },
        {
          id: 'p2',
          title: 'Monthly',
          recurringPattern: 'monthly',
          dueDate: new Date().toISOString(),
          userId: 'user-1'
        },
        {
          id: 'p3',
          title: 'Yearly',
          recurringPattern: 'yearly',
          dueDate: new Date().toISOString(),
          userId: 'user-1'
        }
      ];

      const mockSelect = db.select as Mock;
      mockSelect.mockReturnValueOnce(createMockQueryBuilder(tasksPatterns));
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const response = await app.handle(
        new Request(`http://localhost/api/calendar/ical/user-1/${token}`)
      );
      const text = await response.text();

      expect(text).toContain('RRULE:FREQ=DAILY');
      expect(text).toContain('RRULE:FREQ=MONTHLY');
      expect(text).toContain('RRULE:FREQ=YEARLY');
    });

    it('should handle biweekly and end_of_month patterns', async () => {
      const { createHash } = await import('crypto');
      const token = createHash('sha256').update(`user-1-test-secret`).digest('hex');

      const tasksPatterns = [
        {
          id: 'p4',
          title: 'Biweekly',
          recurringPattern: 'biweekly',
          dueDate: new Date().toISOString(),
          userId: 'user-1'
        },
        {
          id: 'p5',
          title: 'EndOfMonth',
          recurringPattern: 'end_of_month',
          dueDate: new Date().toISOString(),
          userId: 'user-1'
        }
      ];

      const mockSelect = db.select as Mock;
      mockSelect.mockReturnValueOnce(createMockQueryBuilder(tasksPatterns));
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const response = await app.handle(
        new Request(`http://localhost/api/calendar/ical/user-1/${token}`)
      );
      const text = await response.text();

      // Biweekly -> FREQ=WEEKLY;INTERVAL=2
      expect(text).toContain('RRULE:FREQ=WEEKLY;INTERVAL=2');
      // End of Month -> FREQ=MONTHLY;BYMONTHDAY=-1
      expect(text).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=-1');
    });
    it('should valid RRULE for recurring tasks', async () => {
      const { createHash } = await import('crypto');
      const validToken = createHash('sha256').update(`user-1-test-secret`).digest('hex');

      const mockTask = {
        id: 't1',
        title: 'Recurring Task',
        dueDate: new Date().toISOString(),
        userId: 'user-1',
        recurringPattern: 'weekly',
        recurringEndDate: new Date('2025-01-01').toISOString()
      };

      // 1. Tasks
      // 2. Habits
      const mockSelect = db.select as Mock;
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockTask]));
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const response = await app.handle(
        new Request(`http://localhost/api/calendar/ical/user-1/${validToken}`)
      );

      const text = await response.text();
      expect(text).toContain('RRULE:FREQ=WEEKLY');
      expect(text).toContain('UNTIL=20250101');
    });

    it('should include habits with RRULE', async () => {
      const { createHash } = await import('crypto');
      const validToken = createHash('sha256').update(`user-1-test-secret`).digest('hex');

      const mockHabit = {
        id: 'h1',
        name: 'My Habit',
        frequency: 'daily',
        active: true,
        createdAt: new Date().toISOString()
      };

      // 1. Tasks (empty)
      // 2. Habits (found)
      const mockSelect = db.select as Mock;
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockHabit]));

      const response = await app.handle(
        new Request(`http://localhost/api/calendar/ical/user-1/${validToken}`)
      );

      const text = await response.text();
      expect(text).toContain('SUMMARY:My Habit');
      expect(text).toContain('RRULE:FREQ=DAILY');
    });
  });
});
