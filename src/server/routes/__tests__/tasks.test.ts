import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Elysia } from 'elysia';
import { tasksRoutes } from '../tasks';
import { db } from '../../db';
import { wsManager } from '../../websocket';

// Helper to serialize dates to string (simulating JSON response)
const toResponse = (obj: unknown) => JSON.parse(JSON.stringify(obj));

interface MockQueryBuilder {
  from: () => MockQueryBuilder;
  where: () => MockQueryBuilder;
  orderBy: () => MockQueryBuilder;
  limit: () => MockQueryBuilder;
  leftJoin: () => MockQueryBuilder;
  groupBy: () => MockQueryBuilder;
  insert: () => MockQueryBuilder;
  values: () => MockQueryBuilder;
  returning: () => MockQueryBuilder;
  update: () => MockQueryBuilder;
  set: () => MockQueryBuilder;
  delete: () => MockQueryBuilder;
  then: (resolve: (value: unknown) => void) => Promise<void>;
}

const createMockQueryBuilder = (resolvedValue: unknown): MockQueryBuilder => {
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
  } as MockQueryBuilder;
  return builder;
};

const createMockUpdateBuilder = (resolvedValue: unknown) => {
    const builder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(resolvedValue),
        // oxlint-disable-next-line unicorn/no-thenable
        then: (resolve: (value: unknown) => void) => Promise.resolve(resolvedValue).then(resolve)
    };
    return builder;
};

const createMockDeleteBuilder = (resolvedValue: unknown) => {
    const builder = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(resolvedValue),
        // oxlint-disable-next-line unicorn/no-thenable
        then: (resolve: (value: unknown) => void) => Promise.resolve(resolvedValue).then(resolve)
    };
    return builder;
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
    orderBy: vi.fn()
  }
}));

// Mock withAuth
vi.mock('../../auth/withAuth', async () => {
  const { Elysia } = await import('elysia');
  return {
    withAuth: () => new Elysia().derive({ as: 'global' }, () => ({ user: { id: 'user-1', email: 'test@test.com' } }))
  };
});

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

describe('Task Routes', () => {
  let app: Elysia;
  const mockUser = { id: 'user-1', email: 'test@test.com' };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup chainable mocks on the imported db object
    vi.mocked(db.from).mockReturnThis();
    vi.mocked(db.where).mockReturnThis();
    vi.mocked(db.insert).mockReturnThis();
    vi.mocked(db.update).mockImplementation(() => createMockUpdateBuilder([]) as any);
    vi.mocked(db.delete).mockImplementation(() => createMockDeleteBuilder([]) as any);
    vi.mocked(db.limit).mockReturnThis();
    vi.mocked(db.leftJoin).mockReturnThis();
    vi.mocked(db.groupBy).mockReturnThis();
    vi.mocked(db.orderBy).mockReturnThis();

    // Default select
    vi.mocked(db.select).mockReturnValue(createMockQueryBuilder([]) as any);

    app = new Elysia()
      .decorate('db', db)
      .derive(() => ({ user: mockUser }))
      .use(tasksRoutes);
  });

  describe('GET /tasks', () => {
    it('should fetch tasks for a column', async () => {
      const mockTasks = [
        { id: 'task-1', title: 'Task 1', columnId: 'col-1' },
        { id: 'task-2', title: 'Task 2', columnId: 'col-1' }
      ];

      vi.mocked(db.select).mockReturnValue(createMockQueryBuilder(mockTasks) as any);

      const response = await app.handle(new Request('http://localhost/tasks/col-1'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(toResponse(mockTasks));
    });

    it('should apply search, priority, label filters', async () => {
      const url = 'http://localhost/tasks?search=test&priority=high&label=urgent';
      const res = await app.handle(new Request(url));
      expect(res.status).toBe(200);
      expect(db.select).toHaveBeenCalled();
    });

    it('should apply sorting', async () => {
      const sorts = ['priority', 'dueDate', 'createdAt', 'updatedAt'];
      for (const sortBy of sorts) {
        const url = `http://localhost/tasks?sortBy=${sortBy}&sortOrder=asc`;
        await app.handle(new Request(url));
      }
      expect(db.select).toHaveBeenCalledTimes(4);
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
        createdAt: new Date().toISOString()
      };

      const mockChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([createdTask])
      };
      vi.mocked(db.insert).mockReturnValue(mockChain as any);

      const response = await app.handle(
        new Request('http://localhost/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTask)
        })
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(toResponse(createdTask));
      expect(wsManager.broadcastTaskUpdate).toHaveBeenCalledWith('task-new', 'col-1', 'created');
    });

    it('should handle subtasks and labels in creation', async () => {
      const apiMock = db;
      vi.mocked(apiMock.select).mockReturnValue(createMockQueryBuilder([{ id: 'col-1' }]) as any);
      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 't1', title: 'T', columnId: 'col-1', labels: ['L1'] }])
      };
      vi.mocked(apiMock.insert).mockReturnValue(mockInsertChain as any);

      const response = await app.handle(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            title: 'New Task', 
            columnId: 'col-1',
            labels: ['L1'],
            subtasks: [{ title: 'Sub 1' }]
        })
      }));

      expect(response.status).toBe(200);
    });
  });

  describe('PATCH /tasks/:id', () => {
    it('should update a task', async () => {
      const updates = { title: 'Updated Task', completed: true };
      const updatedTask = { id: 'task-1', ...updates, columnId: 'col-1', updatedAt: new Date().toISOString() };

      vi.mocked(db.select).mockReturnValueOnce(createMockQueryBuilder([updatedTask]) as any);
      vi.mocked(db.update).mockReturnValue(createMockUpdateBuilder([updatedTask]) as any);

      const response = await app.handle(
        new Request('http://localhost/tasks/task-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toEqual(toResponse(updatedTask));
    });

    it('should handle subtasks update', async () => {
      const mockTask = { id: 't1', columnId: 'c1', title: 'T' };
      
      vi.mocked(db.select).mockReturnValue(createMockQueryBuilder([mockTask]) as any);
      vi.mocked(db.update).mockReturnValue(createMockUpdateBuilder([mockTask]) as any);
      vi.mocked(db.delete).mockReturnValue(createMockDeleteBuilder([]) as any);
      vi.mocked(db.insert).mockReturnValue(createMockQueryBuilder([]) as any);

      const response = await app.handle(new Request('http://localhost/tasks/t1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            subtasks: [{ title: 'Sub 1', completed: false }] 
        })
      }));

      expect(response.status).toBe(200);
      expect(db.delete).toHaveBeenCalled(); // subtasks delete
      expect(db.insert).toHaveBeenCalled(); // subtasks insert
    });

    it('should handle recurring task completion (create log)', async () => {
        const mockTask = { id: 't1', columnId: 'c1', title: 'T', recurringPattern: 'daily' };
        
        // 1. Get task
        vi.mocked(db.select).mockReturnValueOnce(createMockQueryBuilder([mockTask]) as any); 
        // 2. Get current col
        vi.mocked(db.select).mockReturnValueOnce(createMockQueryBuilder([{ id: 'c1', boardId: 'b1' }]) as any); 
        // 3. Get target col
        vi.mocked(db.select).mockReturnValueOnce(createMockQueryBuilder([{ id: 'c2' }]) as any); 
        // 4. Check existing log
        vi.mocked(db.select).mockReturnValueOnce(createMockQueryBuilder([]) as any); 
        
        vi.mocked(db.insert).mockReturnValue(createMockQueryBuilder([]) as any);
        vi.mocked(db.update).mockReturnValue(createMockUpdateBuilder([mockTask]) as any);

        const response = await app.handle(new Request('http://localhost/tasks/t1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              completed: true,
              instanceDate: '2024-01-01'
          })
        }));

        expect(response.status).toBe(200);
        expect(db.insert).toHaveBeenCalled(); // taskCompletions insert
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
      vi.mocked(db.select)
        .mockReturnValueOnce(createMockQueryBuilder([mockTasks[0]]) as any)
        .mockReturnValueOnce(createMockQueryBuilder([mockColumn]) as any)
        .mockReturnValueOnce(createMockQueryBuilder([doneColumn]) as any)
        // Task 2:
        .mockReturnValueOnce(createMockQueryBuilder([mockTasks[1]]) as any)
        .mockReturnValueOnce(createMockQueryBuilder([mockColumn]) as any)
        .mockReturnValueOnce(createMockQueryBuilder([doneColumn]) as any);

      vi.mocked(db.update).mockReturnValue(createMockUpdateBuilder([{ id: 'task-updated' }]) as any);

      const response = await app.handle(
        new Request('http://localhost/tasks/bulk-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskIds, completed: true })
        })
      );

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('POST /tasks/reorder', () => {
    it('should reorder tasks in a column', async () => {
      const columnId = 'col-1';
      const taskIds = ['task-2', 'task-1'];

      vi.mocked(db.select).mockReturnValueOnce(createMockQueryBuilder([{ id: columnId }]) as any);
      vi.mocked(db.update).mockReturnValue(createMockUpdateBuilder([]) as any);

      const response = await app.handle(
        new Request('http://localhost/tasks/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columnId, taskIds })
        })
      );

      expect(response.status).toBe(200);
      expect(db.update).toHaveBeenCalled();
    });

    it('should return 500 if column not found during reorder', async () => {
        vi.mocked(db.select).mockReturnValueOnce(createMockQueryBuilder([]) as any);
        const response = await app.handle(new Request('http://localhost/tasks/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ columnId: 'bad', taskIds: [] })
        }));
        expect(response.status).toBe(500);
    });
  });
});