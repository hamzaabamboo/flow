import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Elysia } from 'elysia';
import { withAuth } from '../withAuth';
import { db } from '../../db';
import { validateHamAuthTokenCached } from '../hamauth-utils';

// Mock DB module
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn()
  }
}));

// Mock hamauth-utils
vi.mock('../hamauth-utils', () => ({
  validateHamAuthTokenCached: vi.fn()
}));

// Define Mock DB Chain Helper
const createMockQueryBuilder = (resolvedValue: any) => {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    // oxlint-disable-next-line unicorn/no-thenable
    then: (resolve: any) => Promise.resolve(resolvedValue).then(resolve)
  };
};

describe('withAuth Elysia middleware', () => {
  let app: Elysia;
  const mockUser = { id: 'u1', email: 'test@example.com', name: 'Test User' };
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NODE_ENV = 'development';

    (db as any).select.mockReturnValue(createMockQueryBuilder([mockUser]));
    (db as any).update.mockReturnValue(createMockQueryBuilder([]));
    (db as any).insert.mockReturnValue(createMockQueryBuilder([mockUser]));

    app = new Elysia().use(withAuth()).get('/test', ({ user }) => ({ user }));
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should auto-login in development if no token', async () => {
    // Already set to development in beforeEach

    const response = await app.handle(new Request('http://localhost/test'));

    if (response.status !== 200) {
      console.error('Auto-login failed:', await response.text());
    }

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.user.email).toBe(mockUser.email);

    // In happy-dom/elysia test, check for Set-Cookie header
    const setCookie = response.headers.get('Set-Cookie') || response.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    if (setCookie) {
      expect(setCookie).toContain('auth=');
    }
  });

  it('should authenticate with Bearer API token', async () => {
    const mockTokenRecord = {
      id: 't1',
      token: 'mock-hash-sha256-hex-valid-token',
      userId: 'u1',
      expiresAt: null
    };

    // Setup specific sequence for this test
    const mockSelect = vi.fn();
    (db as any).select = mockSelect;

    mockSelect
      .mockReturnValueOnce(createMockQueryBuilder([mockTokenRecord])) // Find token
      .mockReturnValueOnce(createMockQueryBuilder([mockUser])); // Find user

    const response = await app.handle(
      new Request('http://localhost/test', {
        headers: { Authorization: 'Bearer valid-token' }
      })
    );

    if (response.status !== 200) {
      console.error('Bearer auth failed:', await response.text());
    }

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.id).toBe('u1');
  });

  it('should fail with expired API token', async () => {
    const expiredDate = new Date(Date.now() - 10000).toISOString();
    const mockTokenRecord = {
      id: 't1',
      token: 'mock-hash-sha256-hex-expired-token',
      userId: 'u1',
      expiresAt: expiredDate
    };

    (db as any).select.mockReturnValueOnce(createMockQueryBuilder([mockTokenRecord]));

    const response = await app.handle(
      new Request('http://localhost/test', {
        headers: { Authorization: 'Bearer expired-token' }
      })
    );

    expect(response.status).toBe(401);
  });

  it('should validate with HamAuth if not an API token', async () => {
    // 1. Select token returns nothing
    (db as any).select.mockReturnValueOnce(createMockQueryBuilder([]));

    // 2. HamAuth validation success
    (validateHamAuthTokenCached as any).mockResolvedValue({
      sub: 'ext-1',
      email: 'ham@example.com'
    });

    // 3. Find or create user
    (db as any).select.mockReturnValueOnce(
      createMockQueryBuilder([{ id: 'u2', email: 'ham@example.com' }])
    );

    const response = await app.handle(
      new Request('http://localhost/test', {
        headers: { Authorization: 'Bearer ham-token' }
      })
    );

    const data = await response.json();
    expect(data.user.email).toBe('ham@example.com');
  });

  it('should return 401 if no authentication provided in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const response = await app.handle(new Request('http://localhost/test'));
    expect(response.status).toBe(401);

    process.env.NODE_ENV = originalEnv;
  });
});
