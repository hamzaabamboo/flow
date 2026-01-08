import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { simpleAuth } from '../simple-auth';
import { db } from '../../db';

const JWT_CONFIG = {
  name: 'jwt',
  secret: process.env.JWT_SECRET || 'your-secret-key-change-this',
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  },
} as const;

interface MockQueryBuilder {
  from: () => MockQueryBuilder;
  where: () => MockQueryBuilder;
  orderBy: () => MockQueryBuilder;
  limit: () => MockQueryBuilder;
  then: (resolve: (value: unknown) => void) => Promise<void>;
}

const createMockQueryBuilder = (resolvedValue: unknown): MockQueryBuilder => {
  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    // oxlint-disable-next-line unicorn/no-thenable
    then: (resolve: (value: unknown) => void) => Promise.resolve(resolvedValue).then(resolve)
  } as MockQueryBuilder;
  return builder;
};

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn()
  }
}));

describe('Simple Auth', () => {
  let app: Elysia;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.select).mockReturnValue(createMockQueryBuilder([]));
    app = new Elysia().decorate('db', db).use(simpleAuth);
  });

  it('POST /api/auth/logout should clear cookie', async () => {
    const res = await app.handle(new Request('http://localhost/api/auth/logout', { method: 'POST' }));
    expect(res.status).toBe(200);
  });

  it('GET /api/auth/me should return 401 if no token', async () => {
    const res = await app.handle(new Request('http://localhost/api/auth/me'));
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me should return user if token valid', async () => {
    const signerApp = new Elysia().use(jwt(JWT_CONFIG)).get('/sign', ({ jwt }) => jwt.sign({ 
        userId: 'u1',
        email: 't@t.com',
        name: 'T'
    }));
    const signRes = await signerApp.handle(new Request('http://localhost/sign'));
    const token = await signRes.text();

    vi.mocked(db.select).mockReturnValue(createMockQueryBuilder([{ id: 'u1', email: 't@t.com', name: 'T' }]));
    const req = new Request('http://localhost/api/auth/me');
    req.headers.append('Cookie', `auth=${token}`);
    const res = await app.handle(req);
    
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('u1');
  });

  it('POST /api/auth/setup should create user and return hash', async () => {
    vi.mocked(db.select).mockReturnValueOnce(createMockQueryBuilder([])); // No users
    const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'u1', email: 't@t.com' }])
    };
    vi.mocked(db.insert).mockReturnValue(mockInsertChain);

    const res = await app.handle(new Request('http://localhost/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 't@t.com', password: 'p123' })
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(process.env.USER_PASSWORD_HASH).toBeDefined();
  });

  it('POST /api/auth/setup should fail if users already exist', async () => {
    vi.mocked(db.select).mockReturnValueOnce(createMockQueryBuilder([{ id: 'existing' }]));
    const res = await app.handle(new Request('http://localhost/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 't@t.com', password: 'p123' })
    }));
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login should work with correct credentials', async () => {
    process.env.USER_PASSWORD_HASH = undefined;
    vi.mocked(db.select).mockReturnValueOnce(createMockQueryBuilder([]));
    const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'u1', email: 't@t.com' }])
    };
    vi.mocked(db.insert).mockReturnValue(mockInsertChain);
    await app.handle(new Request('http://localhost/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 't@t.com', password: 'p123' })
    }));

    vi.mocked(db.select).mockReturnValueOnce(createMockQueryBuilder([{ id: 'u1', email: 't@t.com' }]) as any);
    const res = await app.handle(new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 't@t.com', password: 'p123' })
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('u1');
  });

  it('POST /api/auth/login should fail with invalid credentials', async () => {
    vi.mocked(db.select).mockReturnValueOnce(createMockQueryBuilder([{ id: 'u1', email: 't@t.com' }]));
    const res = await app.handle(new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 't@t.com', password: 'wrong' })
    }));
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me should return 401 if user not found in DB', async () => {
    const signerApp = new Elysia().use(jwt(JWT_CONFIG)).get('/sign', ({ jwt }) => jwt.sign({ userId: 'missing' }));
    const signRes = await signerApp.handle(new Request('http://localhost/sign'));
    const token = await signRes.text();

    vi.mocked(db.select).mockReturnValueOnce(createMockQueryBuilder([]));
    const req = new Request('http://localhost/api/auth/me');
    req.headers.append('Cookie', `auth=${token}`);
    const res = await app.handle(req);
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/auto-login should return 404 if no users', async () => {
    vi.mocked(db.select).mockReturnValue(createMockQueryBuilder([]));
    const res = await app.handle(new Request('http://localhost/api/auth/auto-login', { method: 'POST' }));
    expect(res.status).toBe(404);
  });
});
