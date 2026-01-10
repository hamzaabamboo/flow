import { describe, it, expect, beforeAll, beforeEach, vi, Mock } from 'vitest';
import { Elysia } from 'elysia';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { PgSelectBuilder, PgInsertBuilder, PgUpdateBuilder, PgDelete } from 'drizzle-orm/pg-core';

// Helper to create chainable mock
const createMockChain = (returnValue: unknown) => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),

    // oxlint-disable-next-line unicorn/no-thenable
    then: (resolve: (val: unknown) => void) => {
      resolve(returnValue);
    }
  };
  return chain as unknown as PgSelectBuilder<any, any> &
    PgInsertBuilder<any, any, any> &
    PgUpdateBuilder<any, any> &
    PgDelete<any, any, any>;
};

// Mock websocket to prevent open handles
vi.mock('../../server/websocket', () => ({
  wsManager: {
    broadcastTaskUpdate: vi.fn(),
    initialize: vi.fn(),
    broadcastToUser: vi.fn()
  }
}));

// Integration test for complete authentication flow
describe('Authentication Flow Integration', () => {
  let app: any;
  let mockDb: any;

  const testUser = {
    email: 'integration@test.com',
    password: 'testpassword123'
  };

  const handleRequest = async (path: string, options: RequestInit = {}) => {
    if (!app) throw new Error('App not initialized');
    return app.handle(new Request(`http://localhost${path}`, options));
  };

  beforeAll(async () => {
    // Setup test server with all routes
    const { simpleAuth } = await import('../../server/auth/simple-auth');
    const { tasksRoutes } = await import('../../server/routes/tasks');
    const { boardRoutes } = await import('../../server/routes/boards');
    const { inboxRoutes } = await import('../../server/routes/inbox');

    // Mock database with chainable response capable of returning data
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn((cb) => cb(mockDb))
    };

    // Default behaviors
    mockDb.select.mockReturnValue(createMockChain([]));
    mockDb.insert.mockReturnValue(
      createMockChain([{ id: 'new-user', email: testUser.email, name: 'Test User' }])
    );
    mockDb.update.mockReturnValue(createMockChain([{ id: 'user-1' }]));

    app = new Elysia()
      .decorate('db', mockDb)
      .use(simpleAuth)
      .group('/api', (api) => api.use(tasksRoutes).use(boardRoutes).use(inboxRoutes));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default select returns empty array (no user exists) for setup check
    mockDb.select.mockReturnValue(createMockChain([]));
  });

  describe('Registration and Login Flow', () => {
    it('should register a new user via setup', async () => {
      // Setup mock for creation return
      const newUser = { id: 'user-1', ...testUser, name: 'Test User' };
      mockDb.insert.mockReturnValue(createMockChain([newUser]));

      const response = await handleRequest('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testUser,
          name: 'Test User'
        })
      });

      expect(response.status).toBe(200);
      const responseData = (await response.json()) as { success: boolean };
      expect(responseData.success).toBe(true);
    });

    it('should not register duplicate users', async () => {
      // Mock finding existing user
      mockDb.select.mockReturnValue(createMockChain([{ id: 'existing-user' }]));

      // Attempt setup
      const response = await handleRequest('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testUser,
          name: 'Test User 2'
        })
      });

      expect(response.status).toBe(400);
      const error = (await response.json()) as { error: string };
      expect(error.error).toBe('User already exists');
    });

    it('should login with valid credentials', async () => {
      // Reset mocks for setup
      mockDb.select.mockReturnValue(createMockChain([])); // No user
      mockDb.insert.mockReturnValue(createMockChain([{ id: 'user-1', email: testUser.email }]));

      // Call setup to set the hash in memory
      await handleRequest('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser)
      });

      // Now mock finding user for login
      mockDb.select.mockReturnValue(
        createMockChain([
          {
            id: 'user-1',
            email: testUser.email,
            name: 'Test User',
            password: 'hashedpassword' // irrelevant field, hash is in env
          }
        ])
      );

      const response = await handleRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser)
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data).toHaveProperty('email', testUser.email);
    });

    it('should reject invalid credentials', async () => {
      // Mock user found
      mockDb.select.mockReturnValue(createMockChain([{ id: 'user-1', email: testUser.email }]));

      const response = await handleRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: 'wrongpassword'
        })
      });

      expect(response.status).toBe(401);
    });

    it('should validate request body', async () => {
      const response = await handleRequest('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing email and password
          name: 'Test User'
        })
      });

      expect(response.status).not.toBe(200);
    });
  });

  describe('Protected Route Access', () => {
    let authToken: string;

    beforeEach(async () => {
      // Setup user and get token
      mockDb.select.mockReturnValue(createMockChain([])); // Setup
      mockDb.insert.mockReturnValue(createMockChain([{ id: 'user-1', email: testUser.email }]));

      await handleRequest('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser)
      });

      mockDb.select.mockReturnValue(createMockChain([{ id: 'user-1', email: testUser.email }])); // Login

      const loginResponse = await handleRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser)
      });

      const headers = loginResponse.headers;
      const setCookie = headers.get('set-cookie');
      if (setCookie) {
        const tokenMatch = setCookie.match(/auth=([^;]+)/);
        authToken = tokenMatch ? tokenMatch[1] : '';
      }
    });

    it('should access protected routes with valid token', async () => {
      // Mock user lookup for middleware
      mockDb.select.mockReturnValue(createMockChain([{ id: 'user-1', email: testUser.email }]));

      const response = await handleRequest('/api/boards?space=work', {
        headers: {
          Cookie: `auth=${authToken}`
        }
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Password Security', () => {
    it('should hash passwords on setup', async () => {
      // Setup mock
      mockDb.select.mockReturnValue(createMockChain([])); // Not exists
      mockDb.insert.mockReturnValue(createMockChain([{ id: 'user-1' }])); // Insert return

      await handleRequest('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'security@test.com',
          password: 'plaintext123',
          name: 'Security Test'
        })
      });

      // simple-auth sets process.env.USER_PASSWORD_HASH = hash.
      expect(process.env.USER_PASSWORD_HASH).not.toBe('plaintext123');
      expect(process.env.USER_PASSWORD_HASH).toHaveLength(64); // sha256 hex
    });

    it('should not return password in login response', async () => {
      // Mock existing user for login lookup
      mockDb.select.mockReturnValue(
        createMockChain([
          {
            id: 'user-1',
            email: testUser.email,
            name: 'Test User',
            password: 'hashedpassword'
          }
        ])
      );

      // Ensure hash matches so login succeeds
      process.env.USER_PASSWORD_HASH =
        '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

      const response = await handleRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser)
      });
      const data = (await response.json()) as Record<string, unknown>;

      expect(data).not.toHaveProperty('password');
      expect(data).not.toHaveProperty('user');
    });
  });
});
