import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';
import * as schema from '../../../../drizzle/schema';
import {
  verifyBoardOwnership,
  verifyTaskOwnership,
  verifyColumnOwnership,
  verifyHabitOwnership,
  verifySubtaskOwnership
} from '../ownership';
import { asMock } from '../../../test/mocks/api';

// Mock DB chain helper
const createMockQueryBuilder = (resolvedValue: unknown) => {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    // oxlint-disable-next-line unicorn/no-thenable
    then: (resolve: (val: unknown) => void) => Promise.resolve(resolvedValue).then(resolve)
  };
};

describe('ownership utils', () => {
  const mockDb = {
    select: vi.fn(),
    $client: {} as unknown as Sql
  } as unknown as PostgresJsDatabase<typeof schema> & { $client: Sql };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifyBoardOwnership should return true if board exists for user', async () => {
    asMock(mockDb.select).mockReturnValue(createMockQueryBuilder([{ id: 'b1' }]));

    const result = await verifyBoardOwnership(mockDb, 'b1', 'u1');
    expect(result).toBe(true);
  });

  it('verifyBoardOwnership should return false if board does not exist', async () => {
    asMock(mockDb.select).mockReturnValue(createMockQueryBuilder([]));

    const result = await verifyBoardOwnership(mockDb, 'b1', 'u1');
    expect(result).toBe(false);
  });

  it('verifyTaskOwnership should return true if task exists for user', async () => {
    asMock(mockDb.select).mockReturnValue(createMockQueryBuilder([{ id: 't1' }]));

    const result = await verifyTaskOwnership(mockDb, 't1', 'u1');
    expect(result).toBe(true);
  });

  it('verifyColumnOwnership should return true if column belongs to user board', async () => {
    asMock(mockDb.select).mockReturnValue(createMockQueryBuilder([{ boardId: 'b1' }]));

    const result = await verifyColumnOwnership(mockDb, 'c1', 'u1');
    expect(result).toBe(true);
  });

  it('verifyHabitOwnership should return true if habit exists for user', async () => {
    asMock(mockDb.select).mockReturnValue(createMockQueryBuilder([{ id: 'h1' }]));

    const result = await verifyHabitOwnership(mockDb, 'h1', 'u1');
    expect(result).toBe(true);
  });

  it('verifySubtaskOwnership should return true if subtask belongs to user task', async () => {
    asMock(mockDb.select).mockReturnValue(createMockQueryBuilder([{ taskId: 't1' }]));

    const result = await verifySubtaskOwnership(mockDb, 's1', 'u1');
    expect(result).toBe(true);
  });
});
