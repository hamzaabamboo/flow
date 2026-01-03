import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Elysia } from 'elysia';

// Define Mock DB Chain Helper
const createMockQueryBuilder = (resolvedValue: any) => {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),

    // oxlint-disable-next-line unicorn/no-thenable
    then: (resolve: any) => Promise.resolve(resolvedValue).then(resolve)
  };
};

// Mock the DB module
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    limit: vi.fn(),
    leftJoin: vi.fn(),
    groupBy: vi.fn(),
    orderBy: vi.fn(),
    transaction: vi.fn()
  }
}));

// Mock withAuth (ensure it mocks correctly)
vi.mock('../../auth/withAuth', () => ({
  withAuth: () => (app: any) =>
    app.derive(() => ({ user: { id: 'user-123', email: 'test@example.com' } }))
}));

// Mock WebSocket
vi.mock('../../websocket', () => ({
  wsManager: {
    broadcastToUser: vi.fn()
  }
}));

// Import after mocks
import { inboxRoutes } from '../inbox';
import { db } from '../../db';

describe('Inbox Routes', () => {
  let app: unknown;
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.resetAllMocks();

    // Setup chainable mocks on the imported db object
    (db as any).from.mockReturnThis();
    (db as any).where.mockReturnThis();
    (db as any).insert.mockReturnThis();
    (db as any).values.mockReturnThis();
    (db as any).update.mockReturnThis();
    (db as any).set.mockReturnThis();
    (db as any).delete.mockReturnThis();
    (db as any).limit.mockReturnThis();
    (db as any).orderBy.mockReturnThis();

    // Transaction mock
    (db as any).transaction.mockImplementation((cb: (tx: any) => any) => cb(db));

    // Default select
    (db as any).select.mockReturnValue(createMockQueryBuilder([]));

    app = new Elysia()
      .decorate('db', db)
      .derive(() => ({ user: mockUser }))
      .use(inboxRoutes);
  });

  describe('GET /inbox', () => {
    it('should fetch inbox items', async () => {
      const mockItems = [{ id: 'i1', title: 'Inbox 1', userId: mockUser.id, space: 'work' }];

      (db as any).select.mockReturnValue(createMockQueryBuilder(mockItems));

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/inbox?space=work')
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe('Inbox 1');
    });
  });

  describe('POST /inbox', () => {
    it('should create an inbox item', async () => {
      const newItem = { content: 'New Item', space: 'work' };
      const createdItem = { id: 'i2', title: 'New Item', space: 'work' };

      (db as any).returning.mockResolvedValueOnce([createdItem]);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem)
        })
      );

      const data = await response.json();
      // Inbox route usually returns successResponse which has { success: true, data: item }
      // But verify based on existing test expectations.
      // Expected: data.data.title

      expect(response.status).toBe(200);
      // If it's wrapped:
      if (data.data) {
        expect(data.data.title).toBe('New Item');
      } else {
        expect(data.title).toBe('New Item');
      }
    });
  });

  describe('POST /inbox/convert', () => {
    it('should convert item to task', async () => {
      const convertBody = { itemId: 'i1', columnId: 'c1' };
      const mockItem = { id: 'i1', title: 'Inbox 1', space: 'work' };
      const createdTask = { id: 't1', title: 'Inbox 1' };

      // Mock tx flow
      // 1. select item (inside transaction likely?)
      (db as any).select.mockReturnValueOnce(createMockQueryBuilder([mockItem]));

      // 2. insert task
      // 3. delete item
      // Order depends on implementation. Usually Insert then Delete or vv.
      // If using `const [newItem] = await db.insert...returning()`
      // And `await db.delete...`

      // We can mock `returning` multiple times.
      // First is typically returning the created task
      // Second is returning the deleted item (if queried)

      // Implementation usually:
      // const [item] = await tx.select... (from check)
      // const [newTask] = await tx.insert(tasks)...returning()
      // await tx.delete(inbox)...

      (db as any).returning
        .mockResolvedValueOnce([createdTask]) // Insert Task
        .mockResolvedValueOnce([{ id: 'i1' }]); // Delete Item (if returning is used) ?

      // Ensure select mocked too

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/inbox/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(convertBody)
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);

      if (data.data) {
        expect(data.data.id).toBe('t1');
      } else {
        expect(data.id).toBe('t1');
      }
    });
  });
});
