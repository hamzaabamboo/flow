import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Elysia } from 'elysia';
import { taskRoutes } from '../tasks';

// Mock database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
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
    broadcastTaskUpdate: vi.fn()
  }
}));

describe('Task Routes', () => {
  let app: unknown;
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Elysia()
      .decorate('db', mockDb as unknown as Record<string, unknown>)
      .derive(() => ({ user: mockUser }))
      .use(taskRoutes);
  });

  describe('GET /tasks/:columnId', () => {
    it('should fetch tasks for a column', async () => {
      const mockTasks = [
        { id: 'task-1', title: 'Task 1', columnId: 'col-1' },
        { id: 'task-2', title: 'Task 2', columnId: 'col-1' }
      ];

      mockDb.returning.mockResolvedValueOnce(mockTasks);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks/col-1')
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockTasks);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
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

      mockDb.returning.mockResolvedValueOnce([createdTask]);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTask)
        })
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(createdTask);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          ...newTask,
          userId: mockUser.id
        })
      );
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

      mockDb.returning.mockResolvedValueOnce([updatedTask]);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks/task-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        })
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(updatedTask);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updates,
          updatedAt: expect.any(Date)
        })
      );
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

      mockDb.returning.mockResolvedValueOnce([updatedTask]);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks/task-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        })
      );

      expect(response.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('DELETE /tasks/:taskId', () => {
    it('should delete a task', async () => {
      const mockTask = {
        id: 'task-1',
        columnId: 'col-1',
        title: 'Task to delete'
      };

      mockDb.limit.mockReturnThis();
      mockDb.returning.mockResolvedValueOnce([mockTask]);

      const response = await (app as { handle: (request: Request) => Promise<Response> }).handle(
        new Request('http://localhost/tasks/task-1', {
          method: 'DELETE'
        })
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });
  });
});
