import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Elysia } from 'elysia';

// Integration test for complete authentication flow
describe('Authentication Flow Integration', () => {
  interface TestApp {
    stop: () => Promise<void>;
  }
  let app: TestApp | null = null;
  let client: {
    auth: {
      register: {
        post: (data: unknown) => Promise<{ data: unknown; status?: number; error?: string }>;
      };
      login: {
        post: (data: unknown) => Promise<{ data: unknown; status?: number; error?: string }>;
      };
    };
  };

  const testUser = {
    email: 'integration@test.com',
    password: 'testpassword123'
  };

  beforeAll(async () => {
    // Setup test server with all routes
    const { simpleAuth } = await import('../../server/auth/simple-auth');
    const { authMiddleware } = await import('../../server/auth/middleware');
    const { taskRoutes } = await import('../../server/routes/tasks');
    const { boardRoutes } = await import('../../server/routes/boards');
    const { inboxRoutes } = await import('../../server/routes/inbox');

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

    app = new Elysia()
      .state('db', mockDb)
      .use(simpleAuth)
      .group('/api', (app) =>
        app.use(authMiddleware).use(taskRoutes).use(boardRoutes).use(inboxRoutes)
      )
      .listen(3333) as unknown as TestApp;

    client = {} as typeof client;
  });

  afterAll(async () => {
    if (app) await app.stop();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Registration and Login Flow', () => {
    it('should register a new user', async () => {
      const response = await client.auth.register.post({
        ...testUser,
        name: 'Test User'
      });

      expect(response.status).toBe(200);
      const responseData = response.data as { user?: { email: string }; token?: string };
      expect(responseData).toHaveProperty('user');
      expect(responseData).toHaveProperty('token');
      expect(responseData.user?.email).toBe(testUser.email);
    });

    it('should not register duplicate users', async () => {
      // First registration
      await client.auth.register.post({
        ...testUser,
        name: 'Test User'
      });

      // Attempt duplicate registration
      const response = await client.auth.register.post({
        ...testUser,
        name: 'Test User 2'
      });

      expect(response.status).toBe(400);
      expect(response.error).toHaveProperty('message');
    });

    it('should login with valid credentials', async () => {
      const response = await client.auth.login.post(testUser);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('user');
      expect(response.data).toHaveProperty('token');
    });

    it('should reject invalid credentials', async () => {
      const response = await client.auth.login.post({
        email: testUser.email,
        password: 'wrongpassword'
      });

      expect(response.status).toBe(401);
    });

    it('should validate email format', async () => {
      const response = await client.auth.register.post({
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User'
      });

      expect(response.status).toBe(422);
    });
  });

  describe('Protected Route Access', () => {
    let authToken: string;

    beforeEach(async () => {
      const loginResponse = await client.auth.login.post(testUser);
      authToken = (loginResponse.data as { token?: string })?.token || '';
    });

    it('should access protected routes with valid token', async () => {
      const response = await fetch('http://localhost:3333/api/boards?space=work', {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
    });

    it('should reject access without token', async () => {
      const response = await fetch('http://localhost:3333/api/boards?space=work');

      expect(response.status).toBe(401);
    });

    it('should reject access with invalid token', async () => {
      const response = await fetch('http://localhost:3333/api/boards?space=work', {
        headers: {
          Authorization: 'Bearer invalid-token'
        }
      });

      expect(response.status).toBe(401);
    });

    it('should create resources with authenticated user', async () => {
      const response = await fetch('http://localhost:3333/api/boards', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Board',
          space: 'work'
        })
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data.name).toBe('Test Board');
    });
  });

  describe('Session Management', () => {
    it('should maintain user context across requests', async () => {
      const loginResponse = await client.auth.login.post(testUser);
      const token = (loginResponse.data as { token?: string })?.token;

      // First request - create board
      const boardResponse = await fetch('http://localhost:3333/api/boards', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Session Test Board',
          space: 'work'
        })
      });

      const board = await boardResponse.json();

      // Second request - get boards
      const listResponse = await fetch('http://localhost:3333/api/boards?space=work', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const boards = await listResponse.json();
      expect(boards).toContainEqual(
        expect.objectContaining({
          id: board.id,
          name: 'Session Test Board'
        })
      );
    });

    it('should handle token expiration gracefully', async () => {
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';

      const response = await fetch('http://localhost:3333/api/boards?space=work', {
        headers: {
          Authorization: `Bearer ${expiredToken}`
        }
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Password Security', () => {
    it('should hash passwords on registration', async () => {
      const mockDb = (
        app as unknown as {
          decorator: {
            db: {
              insert: { mock: { calls: unknown[][] } };
              values: { mock: { calls: unknown[][] } };
            };
          };
        }
      ).decorator.db;

      await client.auth.register.post({
        email: 'security@test.com',
        password: 'plaintext123',
        name: 'Security Test'
      });

      const _insertCall = mockDb.insert.mock.calls[0];
      const userData = mockDb.values.mock.calls[0][0] as { password: string };

      // Password should be hashed, not plaintext
      expect(userData.password).not.toBe('plaintext123');
      expect(userData.password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt format
    });

    it('should not return password in responses', async () => {
      const response = await client.auth.login.post(testUser);

      expect((response.data as { user?: object })?.user).not.toHaveProperty('password');
    });
  });
});
