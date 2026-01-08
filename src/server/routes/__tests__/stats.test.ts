import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Elysia } from 'elysia';

// Mock DB module
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
  }
}));

// Mock withAuth to directly return a user object
vi.mock('../auth/withAuth', () => ({
  withAuth: () => ({
    name: 'withAuth',
    setup(app: Elysia) {
      return app.derive(() => ({ user: { id: 'u1', email: 'test@example.com' } }));
    },
  }),
}));

interface MockQueryBuilder {
  from: () => MockQueryBuilder;
  where: () => MockQueryBuilder;
  leftJoin: () => MockQueryBuilder;
  orderBy: () => MockQueryBuilder;
  limit: () => MockQueryBuilder;
  then: (resolve: (value: unknown) => void) => Promise<void>;
}

const createMockQueryBuilder = (resolvedValue: unknown): MockQueryBuilder => {
  const builder = {
    from: () => builder,
    where: () => builder,
    leftJoin: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    then: (resolve: (value: unknown) => void) => Promise.resolve(resolvedValue).then(resolve)
  } as MockQueryBuilder;
  return builder;
};

// Import createStatsRoutes AFTER all its dependencies (db, withAuth) are mocked
import { createStatsRoutes } from '../stats';
import { db } from '../../db';

describe('Stats Routes', () => {
  let mockFetch: vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn(); // Initialize mockFetch for each test
  });

  it('GET /stats/badges should work', async () => {
    const apiMock = db;
    
    // 1. Inbox count select (mocked separately for badges test)
    vi.mocked(apiMock.select).mockReturnValueOnce(createMockQueryBuilder([{ id: 'i1' }]));
    
    // 2. User tasks select
    vi.mocked(apiMock.select).mockReturnValueOnce(createMockQueryBuilder([
      { task: { id: 't1', dueDate: new Date().toISOString() }, columnName: 'To Do' }
    ]));

    // Explicitly mock the fetch passed to createStatsRoutes
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'h1', completedToday: false }])
    });

    const app = new Elysia()
        .decorate('db', db) // Use the mocked db from the global scope
        .derive(() => ({ user: { id: 'u1' } })) // Manually provide user context
        .use(createStatsRoutes(mockFetch)); // Use the factory function with mocked fetch
        
    const response = await app.handle(new Request('http://localhost/stats/badges?space=work'));
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.inbox).toBe(1);
    expect(data.agenda).toBe(2); // 1 task + 1 habit
  });

  it('GET /stats/analytics/completions should work', async () => {
    const apiMock = db;
    
    // 1. Analytics tasks select
    vi.mocked(apiMock.select).mockReturnValueOnce(createMockQueryBuilder([
      { id: 't1', title: 'Task 1', updatedAt: new Date(), columnName: 'Done' }
    ]));

    const app = new Elysia()
        .decorate('db', db) // Use the mocked db from the global scope
        .derive(() => ({ user: { id: 'u1' } })) // Manually provide user context
        .use(createStatsRoutes(mockFetch)); // Use the factory function with mocked fetch
        
    const url = 'http://localhost/stats/analytics/completions?startDate=2024-01-01&endDate=2024-12-31&space=personal';
    const response = await app.handle(new Request(url));
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.completions).toHaveLength(1);
  });

  it('GET /stats/test should return working', async () => {
    const app = new Elysia()
        .decorate('db', db) // Use the mocked db from the global scope
        .derive(() => ({ user: { id: 'u1' } })) // Manually provide user context
        .use(createStatsRoutes(mockFetch)); // Use the factory function with mocked fetch
    const response = await app.handle(new Request('http://localhost/stats/test'));
    expect(await response.json()).toEqual({ test: 'working' });
  });
});