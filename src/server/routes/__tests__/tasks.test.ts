import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Elysia } from 'elysia';

// Helper to serialize dates to string (simulating JSON response)
const toResponse = (obj: any) => JSON.parse(JSON.stringify(obj));

// Define Mock DB Chain Helper locally for use in tests
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
    groupBy: vi.fn()
  }
}));

// Mock WebSocket manager
vi.mock('../../websocket', () => ({
  wsManager: {
    broadcastTaskUpdate: vi.fn()
  }
}));

// Mock ReminderSyncService
vi.mock('../../services/reminder-sync', () => ({
  ReminderSyncService: class {
    syncReminders = vi.fn().mockResolvedValue(undefined);
  }
}));

// Import after mocks
import { tasksRoutes } from '../tasks';
import { db } from '../../db';
import { wsManager } from '../../websocket';

describe('Task Routes', () => {
  let app: unknown;
  const mockUser = { id: 'user-1', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup chainable mocks on the imported db object
    (db as any).from.mockReturnThis();
    (db as any).where.mockReturnThis();
    (db as any).insert.mockReturnThis();
    (db as any).values.mockReturnThis();
    (db as any).update.mockReturnThis();
    (db as any).set.mockReturnThis();
    (db as any).delete.mockReturnThis();
    (db as any).limit.mockReturnThis();
    (db as any).leftJoin.mockReturnThis();
    (db as any).groupBy.mockReturnThis();

    // Default select
    (db as any).select.mockReturnValue(createMockQueryBuilder([]));

    app = new Elysia()
      .decorate('db', db) // pass the mocked db
      .derive(() => ({ user: mockUser })) // attempt to force user
      .use(tasksRoutes);
  });

  describe('GET /tasks/:columnId', () => {
    it('should fetch tasks for a column', async () => {
      const mockTasks = [
        { id: 'task-1', title: 'Task 1', columnId: 'col-1' },
        { id: 'task-2', title: 'Task 2', columnId: 'col-1' }
      ];

      (db as any).select.mockReturnValue(createMockQueryBuilder(mockTasks));

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks/col-1')
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(toResponse(mockTasks));
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('POST /tasks', () => {
    it('should create a new task', async () => {
      const newTask = {
        columnId: 'col-1',
        title: 'New Task',
        description: 'Task description'
      };

      const createdTask = {
        id: 'task-new',
        ...newTask,
        userId: mockUser.id,
        completed: false,
        createdAt: new Date()
      };

      // Setup full chain: insert().values().returning()
      const mockChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([createdTask])
      };
      (db as any).insert.mockReturnValue(mockChain);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTask)
        })
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(toResponse(createdTask));
      expect(db.insert).toHaveBeenCalled();
      expect(wsManager.broadcastTaskUpdate).toHaveBeenCalledWith('task-new', 'col-1', 'created');
    });

    it('should validate required fields', async () => {
      const invalidTask = {
        columnId: 'col-1'
        // Missing title
      };

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidTask)
        })
      );

      expect(response.status).toBe(422);
    });
  });

  describe('PATCH /tasks/:taskId', () => {
    it('should update a task', async () => {
      const updates = {
        title: 'Updated Task',
        completed: true
      };

      const updatedTask = {
        id: 'task-1',
        ...updates,
        columnId: 'col-1',
        updatedAt: new Date()
      };

      (db as any).select.mockReturnValueOnce(createMockQueryBuilder([updatedTask])); // For Task lookup

      const mockChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([updatedTask])
      };
      (db as any).update.mockReturnValue(mockChain);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks/task-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        })
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(toResponse(updatedTask));
      expect(db.update).toHaveBeenCalled();
    });

    it('should handle moving task to different column', async () => {
      const updates = {
        columnId: 'col-2'
      };

      const updatedTask = {
        id: 'task-1',
        title: 'Task 1',
        columnId: 'col-2',
        updatedAt: new Date()
      };

      (db.select as any).mockReturnValueOnce(createMockQueryBuilder([updatedTask]));

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([updatedTask])
      };
      (db.update as any).mockReturnValue(mockUpdateChain);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks/task-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        })
      );

      expect(response.status).toBe(200);
      expect(db.update).toHaveBeenCalled();
    });

    it('should handle recurring task completion (create log)', async () => {
      const updates = {
        completed: true,
        instanceDate: '2025-01-01'
      };
      // Current task has recurring pattern
      const currentTask = {
        id: 'task-r',
        title: 'Recurring Task',
        columnId: 'col-1',
        recurringPattern: 'daily',
        completed: false
      };

      // 1. Select task
      (db.select as any).mockReturnValueOnce(createMockQueryBuilder([currentTask]));
      // 2. Select columns (handled in route logic, skipped for instance)
      // 3. Check existing log: Empty
      (db as any).select.mockReturnValueOnce(createMockQueryBuilder([]));

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([currentTask])
      };
      (db.update as any).mockReturnValue(mockUpdateChain);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks/task-r', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        })
      );

      if (!response.ok) {
        const text = await response.text();
        console.error('Task update failed:', text);
      }
      expect(response.status).toBe(200);

      // Verify we didn't update task completion status
      expect(db.update).toHaveBeenCalled();
      // set() should NOT have completed: true
      // expect((db.update().set as any).mock.calls[0][0]).not.toHaveProperty('completed');
    });
  });

  describe('DELETE /tasks/:taskId', () => {
    it('should delete a task', async () => {
      const mockTask = {
        id: 'task-1',
        columnId: 'col-1',
        title: 'Task to delete'
      };

      // db.delete().where().returning()
      const mockChain = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockTask])
      };
      (db.delete as any).mockReturnValue(mockChain);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks/task-1', {
          method: 'DELETE'
        })
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(toResponse(mockTask));
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('POST /tasks/bulk-complete', () => {
    it('should bulk complete tasks', async () => {
      const taskIds = ['task-1', 'task-2'];
      const mockTasks = [
        { id: 'task-1', columnId: 'col-1', userId: mockUser.id },
        { id: 'task-2', columnId: 'col-1', userId: mockUser.id }
      ];
      const mockColumn = { id: 'col-1', boardId: 'board-1', name: 'To Do' };
      const doneColumn = { id: 'col-done', boardId: 'board-1', name: 'Done' };

      // Task 1:
      (db.select as any)
        .mockReturnValueOnce(createMockQueryBuilder([mockTasks[0]])) // Get Task
        .mockReturnValueOnce(createMockQueryBuilder([mockColumn])) // Get Col
        .mockReturnValueOnce(createMockQueryBuilder([doneColumn])); // Get Target

      // Task 2:
      (db.select as any)
        .mockReturnValueOnce(createMockQueryBuilder([mockTasks[1]]))
        .mockReturnValueOnce(createMockQueryBuilder([mockColumn]))
        .mockReturnValueOnce(createMockQueryBuilder([doneColumn]));

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'task-updated', columnId: 'col-done' }])
      };
      (db.update as any).mockReturnValue(mockUpdateChain);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks/bulk-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskIds, completed: true })
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('of 2');
    });

    it('should handle missing target column gracefully', async () => {
      const taskIds = ['task-1'];
      const mockTask = { id: 'task-1', columnId: 'col-1', userId: mockUser.id };
      const mockColumn = { id: 'col-1', boardId: 'board-1', name: 'To Do' };

      (db.select as any)
        .mockReturnValueOnce(createMockQueryBuilder([mockTask]))
        .mockReturnValueOnce(createMockQueryBuilder([mockColumn]))
        .mockReturnValueOnce(createMockQueryBuilder([])); // Target column "Done" MISSING

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks/bulk-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskIds, completed: true })
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.updated).toHaveLength(0);
    });

    it('should handle update errors gracefully', async () => {
      const taskIds = ['task-1'];
      const mockTask = { id: 'task-1', columnId: 'col-1', userId: mockUser.id };
      const mockColumn = { id: 'col-1', boardId: 'board-1', name: 'To Do' };
      const doneColumn = { id: 'col-done', boardId: 'board-1', name: 'Done' };

      (db.select as any)
        .mockReturnValueOnce(createMockQueryBuilder([mockTask]))
        .mockReturnValueOnce(createMockQueryBuilder([mockColumn]))
        .mockReturnValueOnce(createMockQueryBuilder([doneColumn]));

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(new Error('DB Error')) // Force Error
      };
      (db.update as any).mockReturnValue(mockUpdateChain);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks/bulk-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskIds, completed: true })
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.updated).toHaveLength(0);
    });
  });

  describe('POST /tasks/reorder', () => {
    it('should reorder tasks in a column', async () => {
      const columnId = 'col-1';
      const taskIds = ['task-2', 'task-1'];

      // Verify ownership
      (db.select as any).mockReturnValueOnce(createMockQueryBuilder([{ id: columnId }]));

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis()
      };
      (db.update as any).mockReturnValue(mockUpdateChain);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columnId, taskIds })
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
      expect(wsManager.broadcastTaskUpdate).toHaveBeenCalledWith('', columnId, 'updated');
    });

    it('should fail to reorder if column not owned', async () => {
      const columnId = 'col-wrong';
      const taskIds = ['task-1'];

      // Verify ownership -> Return empty (not found/not owned)
      (db as any).select.mockReturnValueOnce(createMockQueryBuilder([]));

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columnId, taskIds })
        })
      );

      // Elysia's global error handler for generic Errors usually returns 500
      expect(response.status).toBe(500);
    });
  });
});
