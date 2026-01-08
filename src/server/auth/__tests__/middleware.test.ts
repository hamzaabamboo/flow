import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import { authMiddleware, optionalAuthMiddleware } from '../middleware';
import { db } from '../../db';

// Mock DB module
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
  }
}));

const createMockQueryBuilder = (resolvedValue: any) => ({
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(resolvedValue)
});

describe('Auth Middleware', () => {
  const mockUser = { id: 'u1', email: 'test@example.com', name: 'Test User' };
  const JWT_CONFIG = { name: 'jwt', secret: process.env.JWT_SECRET || 'your-secret-key' };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('authMiddleware', () => {
    it('should return 401 if no token provided', async () => {
      const app = new Elysia()
        .onError(({ error, set }) => {
          if (error.message === 'Authentication required' || error.message === 'Invalid token') {
            set.status = 401;
            return { error: error.message };
          }
        })
        .use(authMiddleware)
        .get('/test', ({ user }) => ({ user }));

      const response = await app.handle(new Request('http://localhost/test'));
      expect(response.status).toBe(401);
    });

    it('should return 401 for invalid token', async () => {
      const app = new Elysia()
        .onError(({ error, set }) => {
          if (error.message === 'Invalid token') {
            set.status = 401;
            return { error: error.message };
          }
        })
        .use(authMiddleware)
        .get('/test', ({ user }) => ({ user }));

      const req = new Request('http://localhost/test');
      req.headers.append('Cookie', `auth=invalid-token`);
      
      const response = await app.handle(req);
      expect(response.status).toBe(401);
    });

    it('should return 401 if user not found in DB', async () => {
      (db.select as any).mockReturnValue(createMockQueryBuilder([]));
      
      const app = new Elysia()
        .onError(({ error, set }) => {
          if (error.message === 'User not found') {
            set.status = 401;
            return { error: error.message };
          }
        })
        .use(cookie())
        .use(authMiddleware)
        .get('/test', ({ user }) => ({ user }));

      const signerApp = new Elysia().use(jwt(JWT_CONFIG)).get('/sign', ({ jwt }) => jwt.sign({ userId: 'missing' }));
      const signRes = await signerApp.handle(new Request('http://localhost/sign'));
      const token = await signRes.text();

      const req = new Request('http://localhost/test');
      req.headers.append('Cookie', `auth=${token}`);
      
      const response = await app.handle(req);
      expect(response.status).toBe(401);
    });

    it('should authenticate with valid token', async () => {
      (db as any).select.mockReturnValue(createMockQueryBuilder([mockUser]));
      
      const app = new Elysia()
        .use(cookie())
        .use(authMiddleware)
        .get('/test', ({ user }) => ({ user }));

      const signerApp = new Elysia().use(jwt(JWT_CONFIG)).get('/sign', ({ jwt }) => jwt.sign({ userId: 'u1' }));
      const signRes = await signerApp.handle(new Request('http://localhost/sign'));
      const token = await signRes.text();

      const req = new Request('http://localhost/test');
      req.headers.append('Cookie', `auth=${token}`);
      
      const response = await app.handle(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.id).toBe('u1');
    });
  });

  describe('optionalAuthMiddleware', () => {
    it('should return user null if no token', async () => {
      const app = new Elysia()
        .use(optionalAuthMiddleware)
        .get('/test', ({ user }) => ({ user: user ?? null }));

      const response = await app.handle(new Request('http://localhost/test'));
      const data = await response.json();
      expect(data.user).toBeNull();
    });

    it('should return user null if token invalid', async () => {
      const app = new Elysia()
        .use(cookie())
        .use(optionalAuthMiddleware)
        .get('/test', ({ user }) => ({ user: user ?? null }));

      const req = new Request('http://localhost/test');
      req.headers.append('Cookie', `auth=bad-token`);
      
      const response = await app.handle(req);
      const data = await response.json();
      expect(data.user).toBeNull();
    });

    it('should return user if valid token provided', async () => {
      (db as any).select.mockReturnValue(createMockQueryBuilder([mockUser]));

      const app = new Elysia()
        .use(cookie())
        .use(optionalAuthMiddleware)
        .get('/test', ({ user }) => ({ user }));

      const signerApp = new Elysia().use(jwt(JWT_CONFIG)).get('/sign', ({ jwt }) => jwt.sign({ userId: 'u1' }));
      const signRes = await signerApp.handle(new Request('http://localhost/sign'));
      const token = await signRes.text();

      const req = new Request('http://localhost/test');
      req.headers.append('Cookie', `auth=${token}`);
      
      const response = await app.handle(req);
      const data = await response.json();
      expect(data.user.id).toBe('u1');
    });
  });
});
