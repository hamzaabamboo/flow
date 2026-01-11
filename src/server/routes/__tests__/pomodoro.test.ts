import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Elysia } from 'elysia';
import { asMock } from '../../../test/mocks/api';
import { PgSelectBuilder, PgInsertBuilder, PgUpdateBuilder } from 'drizzle-orm/pg-core';

// Define Mock DB Chain Helper

const createMockQueryBuilder = (resolvedValue: unknown) => {
  const builder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(resolvedValue),
    set: vi.fn().mockReturnThis(),
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
    orderBy: vi.fn(),
    onConflictDoUpdate: vi.fn()
  }
}));

// Mock withAuth
vi.mock('../../auth/withAuth', () => ({
  withAuth: () => (app: Elysia) =>
    app.derive(() => ({ user: { id: 'user-123', email: 'test@example.com' } }))
}));

// Mock WebSocket
vi.mock('../../websocket', () => ({
  wsManager: {
    broadcastToUser: vi.fn()
  }
}));

// Import after mocks
import { pomodoroRoutes } from '../pomodoro';
import { db } from '../../db';
import { wsManager } from '../../websocket';

describe('Pomodoro Routes', () => {
  let app: unknown;
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(db.insert).mockReturnValue(createMockQueryBuilder([]));
    vi.mocked(db.update).mockReturnValue(createMockQueryBuilder([]));
    vi.mocked(db.delete).mockReturnValue(createMockQueryBuilder([]));

    app = new Elysia()
      .decorate('db', db)
      .derive(() => ({ user: mockUser }))
      .use(pomodoroRoutes);
  });

  describe('GET /pomodoro', () => {
    it('should fetch today sessions', async () => {
      const mockSessions = [{ id: 's1', duration: 25, userId: mockUser.id }];
      asMock(db.select).mockReturnValue(createMockQueryBuilder(mockSessions));

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/pomodoro')
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
    });
  });

  describe('POST /pomodoro', () => {
    it('should save a completed session', async () => {
      const newSession = { duration: 25, startTime: new Date().toISOString(), taskId: 't1' };
      const savedSession = { id: 's2', ...newSession, userId: mockUser.id };

      vi.mocked(db.insert).mockReturnValueOnce(createMockQueryBuilder([savedSession]));

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/pomodoro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSession)
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.id).toBe('s2');
    });
  });

  describe('GET /pomodoro/active', () => {
    it('should return null if no active state', async () => {
      asMock(db.select).mockReturnValue(createMockQueryBuilder([]));

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/pomodoro/active')
      );

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      expect(data).toBeNull();
    });

    it('should return state with drift correction if running', async () => {
      const startTime = new Date(Date.now() - 10000); // 10 seconds ago
      const mockState = {
        userId: mockUser.id,
        isRunning: true,
        timeLeft: 1500, // 25 mins
        startTime: startTime
      };

      asMock(db.select).mockReturnValue(createMockQueryBuilder([mockState]));
      vi.mocked(db.update).mockReturnValue(createMockQueryBuilder([]));

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/pomodoro/active')
      );

      const data = await response.json();
      expect(data.timeLeft).toBeLessThan(1500);
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('POST /pomodoro/active', () => {
    it('should upsert active state and broadcast', async () => {
      const body = {
        type: 'work',
        duration: 1500,
        timeLeft: 1500,
        isRunning: true,
        completedSessions: 0
      };

      const savedState = { ...body, userId: mockUser.id };
      vi.mocked(db.insert).mockReturnValueOnce(createMockQueryBuilder([savedState]));

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/pomodoro/active', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      );

      expect(response.status).toBe(200);
      expect(wsManager.broadcastToUser).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          type: 'pomodoro-state'
        })
      );
    });
  });

  describe('DELETE /pomodoro/active', () => {
    it('should clear active state and broadcast', async () => {
      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/pomodoro/active', {
          method: 'DELETE'
        })
      );

      expect(response.status).toBe(200);
      expect(db.delete).toHaveBeenCalled();
      expect(wsManager.broadcastToUser).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          data: expect.objectContaining({ event: 'cleared' })
        })
      );
    });
  });
});
