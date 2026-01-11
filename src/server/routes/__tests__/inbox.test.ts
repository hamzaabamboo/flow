import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Elysia } from 'elysia';
import { PgSelectBuilder, PgInsertBuilder, PgUpdateBuilder } from 'drizzle-orm/pg-core';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../drizzle/schema';
import { inboxRoutes } from '../inbox';
import { db } from '../../db';

// Define Mock DB Chain Helper
const createMockQueryBuilder = (resolvedValue: unknown) => {
  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    leftJoin: () => builder,
    groupBy: () => builder,
    insert: () => builder,
    values: () => builder,
    returning: () => builder,
    update: () => builder,
    set: () => builder,
    delete: () => builder,
    // oxlint-disable-next-line unicorn/no-thenable
    then: (resolve: (value: unknown) => void) => Promise.resolve(resolvedValue).then(resolve)
  };
  return builder as unknown as PgSelectBuilder<any, any> &
    PgInsertBuilder<any, any, any> &
    PgUpdateBuilder<any, any>;
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

// Mock withAuth
vi.mock('../../auth/withAuth', async () => {
  const { Elysia } = await import('elysia');
  return {
    withAuth: () =>
      new Elysia().derive({ as: 'global' }, () => ({
        user: { id: 'user-123', email: 'test@example.com' }
      }))
  };
});

// Mock WebSocket
vi.mock('../../websocket', () => ({
  wsManager: {
    broadcastToUser: vi.fn()
  }
}));

describe('Inbox Routes', () => {
  let app: { handle: (request: Request) => Promise<Response> };
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.resetAllMocks();

    // Setup chainable mocks on the imported db object
    vi.mocked(db.insert).mockReturnThis();
    vi.mocked(db.update).mockReturnThis();
    vi.mocked(db.delete).mockReturnThis();

    // Transaction mock
    vi.mocked(db.transaction).mockImplementation((cb: any) => cb(db));

    // Default select
    vi.mocked(db.select).mockReturnValue(createMockQueryBuilder([]));

    app = new Elysia()
      .decorate('db', db as unknown as PostgresJsDatabase<typeof schema>)
      .derive(() => ({ user: mockUser }))
      .use(inboxRoutes);
  });

  describe('GET /inbox', () => {
    it('should fetch inbox items', async () => {
      const mockItems = [{ id: 'i1', title: 'Inbox 1', userId: mockUser.id, space: 'work' }];

      vi.mocked(db.select).mockReturnValue(createMockQueryBuilder(mockItems));

      const response = await app.handle(new Request('http://localhost/inbox?space=work'));

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

      vi.mocked(db.insert).mockReturnValue(createMockQueryBuilder([createdItem]));

      const response = await app.handle(
        new Request('http://localhost/inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem)
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.data.title).toBe('New Item');
    });
  });

  describe('POST /inbox/convert', () => {
    it('should convert item to task', async () => {
      const convertBody = { itemId: 'i1', columnId: 'c1' };
      const mockItem = { id: 'i1', title: 'Inbox 1', space: 'work' };
      const createdTask = { id: 't1', title: 'Inbox 1' };

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          select: vi.fn().mockReturnValue(createMockQueryBuilder([mockItem])),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([createdTask]),
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis()
        };
        return cb(tx);
      });

      const response = await app.handle(
        new Request('http://localhost/inbox/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(convertBody)
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.data.id).toBe('t1');
    });

    it('should return error if item not found during conversion', async () => {
      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          select: vi.fn().mockReturnValue(createMockQueryBuilder([])),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis()
        };
        return cb(tx);
      });

      const res = await app.handle(
        new Request('http://localhost/inbox/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: 'bad', columnId: 'c1' })
        })
      );

      expect(res.status).toBe(500);
    });
  });

  describe('POST /inbox/delete', () => {
    it('should handle multiple items deletion', async () => {
      const mockItems = [
        { id: 'i1', space: 'work' },
        { id: 'i2', space: 'personal' }
      ];
      vi.mocked(db.select).mockReturnValueOnce(createMockQueryBuilder(mockItems));
      vi.mocked(db.delete).mockReturnValue(createMockQueryBuilder([]));

      const res = await app.handle(
        new Request('http://localhost/inbox/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIds: ['i1', 'i2'] })
        })
      );

      expect(res.status).toBe(200);
      expect(db.delete).toHaveBeenCalled();
    });
  });
});
