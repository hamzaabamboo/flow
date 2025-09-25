import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Elysia } from 'elysia';
import { inboxRoutes } from '../inbox';

// Mock database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis()
};

// Mock WebSocket manager
vi.mock('../../websocket', () => ({
  wsManager: {
    broadcastInboxUpdate: vi.fn()
  }
}));

describe('Inbox Routes', () => {
  let app: unknown;
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Elysia()
      .decorate('db', mockDb as unknown as Record<string, unknown>)
      .derive(() => ({ user: mockUser }))
      .use(inboxRoutes);
  });

  describe('GET /inbox', () => {
    it('should fetch inbox items for a space', async () => {
      const mockItems = [
        {
          id: 'item-1',
          title: 'Inbox Item 1',
          space: 'work',
          userId: mockUser.id
        },
        {
          id: 'item-2',
          title: 'Inbox Item 2',
          space: 'work',
          userId: mockUser.id
        }
      ];

      mockDb.returning.mockResolvedValueOnce(mockItems);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/inbox?space=work')
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockItems);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
    });

    it('should filter by space parameter', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/inbox?space=personal')
      );

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('POST /inbox', () => {
    it('should create a new inbox item', async () => {
      const newItem = {
        title: 'New Inbox Item',
        description: 'Description',
        space: 'work',
        source: 'manual'
      };

      const createdItem = {
        id: 'item-new',
        ...newItem,
        userId: mockUser.id,
        processed: false,
        createdAt: new Date()
      };

      mockDb.returning.mockResolvedValueOnce([createdItem]);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem)
        })
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(createdItem);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          ...newItem,
          userId: mockUser.id
        })
      );
    });
  });

  describe('POST /inbox/move', () => {
    it('should move inbox items to a board', async () => {
      const moveRequest = {
        itemIds: ['item-1', 'item-2'],
        boardId: 'board-1'
      };

      // Mock board lookup
      mockDb.limit.mockReturnThis();
      mockDb.returning.mockResolvedValueOnce([{ id: 'board-1', name: 'Test Board' }]);

      // Mock columns lookup
      mockDb.returning.mockResolvedValueOnce([{ id: 'col-1', boardId: 'board-1', position: 0 }]);

      // Mock inbox items lookup
      mockDb.returning.mockResolvedValueOnce([
        { id: 'item-1', title: 'Item 1', userId: mockUser.id, processed: false },
        { id: 'item-2', title: 'Item 2', userId: mockUser.id, processed: false }
      ]);

      // Mock task creation
      mockDb.returning.mockResolvedValueOnce([
        { id: 'task-1', title: 'Item 1', columnId: 'col-1' }
      ]);
      mockDb.returning.mockResolvedValueOnce([
        { id: 'task-2', title: 'Item 2', columnId: 'col-1' }
      ]);

      // Mock item updates
      mockDb.returning.mockResolvedValueOnce([]);
      mockDb.returning.mockResolvedValueOnce([]);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/inbox/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(moveRequest)
        })
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tasksCreated).toBe(2);
    });

    it('should handle board not found', async () => {
      const moveRequest = {
        itemIds: ['item-1'],
        boardId: 'invalid-board'
      };

      mockDb.limit.mockReturnThis();
      mockDb.returning.mockResolvedValueOnce([]); // No board found

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/inbox/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(moveRequest)
        })
      );

      expect(response.status).toBe(500);
    });
  });

  describe('POST /inbox/delete', () => {
    it('should delete inbox items', async () => {
      const deleteRequest = {
        itemIds: ['item-1', 'item-2']
      };

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/inbox/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deleteRequest)
        })
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });

    it('should only delete items belonging to the user', async () => {
      const deleteRequest = {
        itemIds: ['item-1']
      };

      await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/inbox/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deleteRequest)
        })
      );

      expect(mockDb.where).toHaveBeenCalled();
    });
  });
});
