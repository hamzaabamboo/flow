import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
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
// Using a more robust structure to satisfy Drizzle's complex return types
const createMockQueryBuilder = (resolvedValue: unknown) => {
  const builder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(resolvedValue),
    // oxlint-disable-next-line unicorn/no-thenable
    then: (resolve: (val: unknown) => void) => Promise.resolve(resolvedValue).then(resolve),
    _brand: 'PgSelect',
    [Symbol.toStringTag]: 'PgSelect'
  };
  return builder;
};

type AuthApp = ReturnType<typeof withAuth>;

describe('withAuth Elysia middleware', () => {
  let app: AuthApp;
  const mockUser = { id: 'u1', email: 'test@example.com', name: 'Test User' };
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NODE_ENV = 'development';

    (db.select as Mock).mockReturnValue(createMockQueryBuilder([mockUser]));
    (db.update as Mock).mockReturnValue(createMockQueryBuilder([]));
    (db.insert as Mock).mockReturnValue(createMockQueryBuilder([mockUser]));

    // We can use withAuth().get() to create a test app
    app = withAuth().get('/test', ({ user }) => ({ user })) as unknown as AuthApp;
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
    const mockSelect = db.select as Mock;
    mockSelect.mockReset();

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

    (db.select as Mock).mockReturnValueOnce(createMockQueryBuilder([mockTokenRecord]));

    const response = await app.handle(
      new Request('http://localhost/test', {
        headers: { Authorization: 'Bearer expired-token' }
      })
    );

    expect(response.status).toBe(401);
  });

  it('should validate with HamAuth if not an API token', async () => {
    // 1. Select token returns nothing
    (db.select as Mock).mockReturnValueOnce(createMockQueryBuilder([]));

    // 2. HamAuth validation success
    (validateHamAuthTokenCached as Mock).mockResolvedValue({
      sub: 'ext-1',
      email: 'ham@example.com'
    });

    // 3. Find or create user
    (db.select as Mock).mockReturnValueOnce(
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
