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
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),

    // oxlint-disable-next-line unicorn/no-thenable
    then: (resolve: any) => Promise.resolve(resolvedValue).then(resolve)
  };
};

// Mock dependencies
// Mock withAuth to avoid DB queries during auth
vi.mock('../../auth/withAuth', async () => {
  const { Elysia } = await import('elysia');
  const { db } = await import('../../db');
  return {
    withAuth: () =>
      new Elysia({ name: 'with-auth' })
        .decorate('db', db)
        .decorate('user', { id: 'user-1', email: 'test@example.com', name: 'Test User' })
        .derive(() => ({
          user: { id: 'user-1', email: 'test@example.com', name: 'Test User' }
        }))
  };
});

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
    transaction: vi.fn((cb) =>
      cb({
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis()
      })
    )
  }
}));

vi.mock('../../websocket', () => ({
  wsManager: {
    broadcastToUser: vi.fn()
  }
}));

vi.mock('../../utils/ownership', () => ({
  verifyBoardOwnership: vi.fn().mockResolvedValue(true)
}));

import { boardRoutes } from '../boards';
import { db } from '../../db'; // Mocked

describe('Board Routes', () => {
  let app: unknown;
  const mockUser = { id: 'user-1', email: 'test@example.com' };

  beforeEach(() => {
    vi.resetAllMocks();

    // Setup default mock returns for db methods on the main db object
    // (transaction mock is handled in the mock factory above, but we might need to adjust it per test)
    (db as any).select.mockReturnValue(createMockQueryBuilder([]));
    (db as any).insert.mockReturnValue(createMockQueryBuilder([]));
    (db as any).update.mockReturnValue(createMockQueryBuilder([]));
    (db as any).delete.mockReturnValue(createMockQueryBuilder([]));

    app = new Elysia()
      .decorate('db', db)
      .derive(() => ({ user: mockUser }))
      .use(boardRoutes);
  });

  describe('GET /boards', () => {
    it('should list user boards', async () => {
      const mockBoards = [
        { id: 'board-1', name: 'Work Board', userId: 'user-1', space: 'work' },
        { id: 'board-2', name: 'Another Board', userId: 'user-1', space: 'work' }
      ];
      const mockColumns = [{ id: 'col-1', boardId: 'board-1', name: 'To Do' }];

      // First query: fetch boards
      // Second query: fetch columns
      (db.select as any)
        .mockReturnValueOnce(createMockQueryBuilder(mockBoards)) // Boards
        .mockReturnValueOnce(createMockQueryBuilder(mockColumns)); // Columns

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/boards?space=work')
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0]).toHaveProperty('columns');
      // If order is preserved, board-1 is first
      const board1 = data.find((b: any) => b.id === 'board-1');
      expect(board1.columns).toHaveLength(1);
    });

    it('should filter by space', async () => {
      (db.select as any).mockReturnValue(createMockQueryBuilder([]));

      await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/boards?space=personal')
      );

      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('GET /boards/:boardId', () => {
    it('should get single board if owned by user', async () => {
      const mockBoard = { id: 'board-1', name: 'Board', userId: 'user-1' };
      const mockCols = [{ id: 'c1', boardId: 'board-1' }];

      (db.select as any)
        .mockReturnValueOnce(createMockQueryBuilder([mockBoard])) // Board
        .mockReturnValueOnce(createMockQueryBuilder(mockCols)); // Columns

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/boards/board-1')
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.id).toBe('board-1');
      expect(data.columns).toHaveLength(1);
    });

    it('should return 404 if board not found', async () => {
      (db.select as any).mockReturnValueOnce(createMockQueryBuilder([])); // No board

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/boards/board-bad')
      );

      expect(response.status).toBe(404);
    });
  });

  describe('POST /boards', () => {
    it('should create a board with default columns', async () => {
      const newBoard = { id: 'board-new', name: 'New Project', space: 'work', userId: 'user-1' };
      const newColumns = [
        { id: 'col-1', name: 'To Do', boardId: 'board-new' },
        { id: 'col-2', name: 'In Progress', boardId: 'board-new' },
        { id: 'col-3', name: 'Done', boardId: 'board-new' }
      ];

      // Mock transaction
      (db.transaction as any).mockImplementation(async (cb: any) => {
        const txMock = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi
            .fn()
            .mockResolvedValueOnce([newBoard]) // Board insert
            .mockResolvedValueOnce(newColumns), // Columns insert
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis()
        };
        return cb(txMock);
      });

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/boards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Project', space: 'work' })
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      // Success response format: { success: true, data: ... }
      expect(data.data.name).toBe('New Project');
      expect(data.data.columns).toHaveLength(3);
    });
  });

  // ... (keeping PATCH and DELETE as is) ...

  describe('GET /boards/:boardId/summary', () => {
    it('should generate summary', async () => {
      const mockBoard = { id: 'board-1', name: 'My Board', userId: 'user-1' };
      const mockColumns = [{ id: 'col-1', name: 'To Do', boardId: 'board-1' }];
      const mockTasks = [
        {
          task: {
            id: 'task-1',
            title: 'Task 1',
            columnId: 'col-1',
            priority: 'high',
            dueDate: new Date().toISOString()
          },
          columnName: 'To Do'
        }
      ];

      // 1. Fetch board
      // 2. Fetch columns
      // 3. Fetch tasks
      (db.select as any)
        .mockReturnValueOnce(createMockQueryBuilder([mockBoard]))
        .mockReturnValueOnce(createMockQueryBuilder(mockColumns))
        .mockReturnValueOnce(createMockQueryBuilder(mockTasks));

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/boards/board-1/summary')
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('summary');
      expect(data.summary).toContain('# My Board');
      expect(data.summary).toContain('Task 1');
    });

    it('should generate summary for specific column', async () => {
      const mockBoard = { id: 'board-1', name: 'My Board', userId: 'user-1' };
      const mockColumns = [
        { id: 'col-1', name: 'To Do', boardId: 'board-1' },
        { id: 'col-2', name: 'Done', boardId: 'board-1' }
      ];
      const mockTasks = [
        {
          task: { id: 'task-1', title: 'Task 1', columnId: 'col-1', priority: 'medium' },
          columnName: 'To Do'
        }
      ];

      (db.select as any)
        .mockReturnValueOnce(createMockQueryBuilder([mockBoard]))
        .mockReturnValueOnce(createMockQueryBuilder(mockColumns))
        .mockReturnValueOnce(createMockQueryBuilder(mockTasks));

      // Request with columnId
      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/boards/board-1/summary?columnId=col-1')
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.columnId).toBe('col-1');
      expect(data.summary).toContain('# My Board - To Do'); // Header includes column name
    });

    it('should return 404 if column not found', async () => {
      const mockBoard = { id: 'board-1', name: 'My Board', userId: 'user-1' };
      const mockColumns = [{ id: 'col-1', name: 'To Do', boardId: 'board-1' }];

      // Return valid board, valid columns list
      (db.select as any)
        .mockReturnValueOnce(createMockQueryBuilder([mockBoard]))
        .mockReturnValueOnce(createMockQueryBuilder(mockColumns));
      // No task fetch expected if column validation fails first?
      // Logic: if (query.columnId) { const column = boardColumns.find... if (!column) return 404 }
      // So check happens BEFORE task fetch?
      // Let's verify boards.ts logic:
      // 1. Fetch Board.
      // 2. Fetch BoardColumns.
      // 3. Fetch Tasks (using query.columnId).
      // 4. Generate Summary -> ERROR CHECK IS HERE (line 255).
      // So Tasks ARE fetched.
      // Wait, logic at line 221: if (query.columnId) { db.select(...).where(eq(tasks.columnId, query.columnId)) }
      // So tasks are fetched for the INVALID column ID. Likely returns empty.
      // Then validation checks if column exists in boardColumns.

      (db.select as any).mockReturnValueOnce(createMockQueryBuilder([])); // Empty tasks

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/boards/board-1/summary?columnId=bad-col')
      );

      expect(response.status).toBe(404);
    });

    it('should return 404 if board not found', async () => {
      (db.select as any).mockReturnValueOnce(createMockQueryBuilder([])); // No board

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/boards/board-1/summary')
      );

      expect(response.status).toBe(404);
    });
  });
});
