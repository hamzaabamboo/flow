import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Elysia } from 'elysia';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../drizzle/schema';
import { db } from '../../db';
import { commandRoutes } from '../command';

const createMockQueryBuilder = (resolvedValue: unknown) => {
  const builder = {
    from: () => builder,
    where: () => builder,
    leftJoin: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    insert: () => builder,
    values: () => builder,
    returning: () => builder,
    update: () => builder,
    set: () => builder,
    delete: () => builder,
    // oxlint-disable-next-line unicorn/no-thenable
    then: (resolve: (value: unknown) => void) => Promise.resolve(resolvedValue).then(resolve)
  };

  return builder as unknown as ReturnType<PostgresJsDatabase['select']>;
};

const createMockUpdateBuilder = (resolvedValue: unknown) => {
  const builder = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(resolvedValue),
    // oxlint-disable-next-line unicorn/no-thenable
    then: (resolve: (value: unknown) => void) => Promise.resolve(resolvedValue).then(resolve)
  };

  return builder as unknown as ReturnType<PostgresJsDatabase['update']>;
};

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock('../../auth/withAuth', async () => {
  const { Elysia: MockElysia } = await import('elysia');
  return {
    withAuth: () =>
      new MockElysia().derive({ as: 'global' }, () => ({
        user: { id: 'user-1', email: 'test@test.com' }
      }))
  };
});

vi.mock('../../../mastra/agents/commandProcessor', () => ({
  commandProcessor: {
    generate: vi.fn()
  }
}));

describe('Command Routes', () => {
  let app: { handle: (request: Request) => Promise<Response> };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.select).mockReturnValue(createMockQueryBuilder([]));
    vi.mocked(db.update).mockReturnValue(createMockUpdateBuilder([]));

    app = new Elysia()
      .decorate('db', db as unknown as PostgresJsDatabase<typeof schema>)
      .derive(() => ({ user: { id: 'user-1', email: 'test@test.com' } }))
      .use(commandRoutes);
  });

  it('should execute complete_task by updating explicit completion state', async () => {
    const task = {
      id: 'task-1',
      title: 'Fix agenda',
      userId: 'user-1',
      columnId: 'col-1'
    };
    const currentColumn = { id: 'col-1', boardId: 'board-1', name: 'To Do' };
    const boardColumns = [
      { id: 'col-1', name: 'To Do' },
      { id: 'col-done', name: 'Done' }
    ];
    const updatedTask = { ...task, columnId: 'col-done' };
    const updateBuilder = createMockUpdateBuilder([updatedTask]);
    const setSpy = (updateBuilder as unknown as { set: ReturnType<typeof vi.fn> }).set;

    vi.mocked(db.select)
      .mockReturnValueOnce(createMockQueryBuilder([task]))
      .mockReturnValueOnce(createMockQueryBuilder([currentColumn]))
      .mockReturnValueOnce(createMockQueryBuilder(boardColumns));
    vi.mocked(db.update).mockReturnValueOnce(updateBuilder);

    const response = await app.handle(
      new Request('http://localhost/command/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_task',
          data: { taskRef: 'Fix agenda' },
          space: 'work'
        })
      })
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.columnId).toBe('col-done');
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        columnId: 'col-done'
      })
    );
  });
});
