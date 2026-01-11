import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Elysia } from 'elysia';
import { autoOrganizeRoutes } from '../autoOrganize';
import { db } from '../../db';
import { autoOrganizer } from '../../../mastra/agents/autoOrganizer';
import { GenerateTextResult } from 'ai';

interface MockQueryBuilder {
  from: () => MockQueryBuilder;
  where: () => MockQueryBuilder;
  leftJoin: () => MockQueryBuilder;
  limit: () => MockQueryBuilder;
  orderBy: () => MockQueryBuilder;
  then: (resolve: (value: unknown) => void) => Promise<void>;
  // Drizzle internal properties to satisfy type checking
  _brand: 'PgSelect';
  [Symbol.toStringTag]: string;
}

const createMockQueryBuilder = (resolvedValue: unknown): MockQueryBuilder => {
  const builder = {
    from: () => builder,
    where: () => builder,
    leftJoin: () => builder,
    limit: () => builder,
    orderBy: () => builder,
    // oxlint-disable-next-line unicorn/no-thenable
    then: (resolve: (value: unknown) => void) => Promise.resolve(resolvedValue).then(resolve),
    _brand: 'PgSelect' as const,
    [Symbol.toStringTag]: 'PgSelect'
  } as unknown as MockQueryBuilder;
  return builder;
};

vi.mock('../../auth/withAuth', async () => {
  const { Elysia } = await import('elysia');
  return {
    withAuth: () => new Elysia().derive({ as: 'global' }, () => ({ user: { id: 'user-1' } }))
  };
});

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    leftJoin: vi.fn(),
    transaction: vi.fn((cb) =>
      cb({
        update: vi.fn(() => createMockQueryBuilder([])),
        delete: vi.fn(() => createMockQueryBuilder([]))
      })
    )
  }
}));

// Mock mastra agent
vi.mock('../../../mastra/agents/autoOrganizer', () => ({
  autoOrganizer: {
    generate: vi.fn()
  },
  AutoOrganizeOutputSchema: {}
}));

describe('Auto Organize Routes', () => {
  let app: { handle: (request: Request) => Promise<Response> };

  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as Mock).mockReturnValue(createMockQueryBuilder([]));

    const mockAiResult: Partial<GenerateTextResult<any, any>> = {
      text: JSON.stringify({
        summary: 'AI Summary',
        suggestions: [
          {
            taskId: 't1',
            reason: 'Reason',
            confidence: 90,
            details: { type: 'column_move', currentColumnId: 'c1', suggestedColumnId: 'c2' }
          }
        ]
      }),
      steps: []
    };

    (autoOrganizer.generate as Mock).mockResolvedValue(mockAiResult);

    app = new Elysia()
      .onError(({ error }) => {
        console.error('AUTO_ORG_ERROR', error);
        return { error: error instanceof Error ? error.message : String(error) };
      })
      .decorate('db', db)
      .derive(() => ({ user: { id: 'user-1' } }))
      .use(autoOrganizeRoutes);
  });

  it('POST / should return suggestions', async () => {
    const apiMock = db;
    (apiMock.select as Mock)
      .mockReturnValueOnce(createMockQueryBuilder([{ id: 'b1', name: 'B1', space: 'work' }]))
      .mockReturnValueOnce(createMockQueryBuilder([{ id: 'c1', name: 'C1', boardId: 'b1' }]))
      .mockReturnValueOnce(
        createMockQueryBuilder([{ id: 't1', title: 'T', columnId: 'c1', columnName: 'C1' }])
      );

    const res = await app.handle(
      new Request('http://localhost/tasks/auto-organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ space: 'work' })
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.summary).toBe('AI Summary');
  });
});
