import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
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
    maxAge: 7 * 24 * 60 * 60
  }
} as const;

interface MockQueryBuilder {
  from: () => MockQueryBuilder;
  where: () => MockQueryBuilder;
  orderBy: () => MockQueryBuilder;
  limit: () => MockQueryBuilder;
  then: (resolve: (value: unknown) => void) => Promise<void>;
  // Drizzle properties
  _brand: string;
  [Symbol.toStringTag]: string;
}

const createMockQueryBuilder = (resolvedValue: unknown): MockQueryBuilder => {
  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    // oxlint-disable-next-line unicorn/no-thenable
    then: (resolve: (value: unknown) => void) => Promise.resolve(resolvedValue).then(resolve),
    _brand: 'PgSelect',
    [Symbol.toStringTag]: 'PgSelect'
  } as unknown as MockQueryBuilder;
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

type SimpleAuthApp = Elysia<any, any, any, any, any, any, any>;

describe('Simple Auth', () => {
  let app: SimpleAuthApp;

  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as Mock).mockReturnValue(createMockQueryBuilder([]));
    app = new Elysia().decorate('db', db).use(simpleAuth);
  });

  it('POST /api/auth/logout should clear cookie', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/auth/logout', { method: 'POST' })
    );
    expect(res.status).toBe(200);
  });

  it('GET /api/auth/me should return 401 if no token', async () => {
    const res = await app.handle(new Request('http://localhost/api/auth/me'));
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me should return user if token valid', async () => {
    const signerApp = new Elysia().use(jwt(JWT_CONFIG)).get('/sign', ({ jwt }) =>
      jwt.sign({
        userId: 'u1',
        email: 't@t.com',
        name: 'T'
      })
    );
    const signRes = await signerApp.handle(new Request('http://localhost/sign'));
    const token = await signRes.text();

    (db.select as Mock).mockReturnValue(
      createMockQueryBuilder([{ id: 'u1', email: 't@t.com', name: 'T' }])
    );
    const req = new Request('http://localhost/api/auth/me');
    req.headers.append('Cookie', `auth=${token}`);
    const res = await app.handle(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('u1');
  });

  it('POST /api/auth/setup should create user and return hash', async () => {
    (db.select as Mock).mockReturnValueOnce(createMockQueryBuilder([])); // No users
    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'u1', email: 't@t.com' }]),
      _brand: 'PgInsert',
      [Symbol.toStringTag]: 'PgInsert'
    };
    (db.insert as Mock).mockReturnValue(mockInsertChain);

    const res = await app.handle(
      new Request('http://localhost/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 't@t.com', password: 'p123' })
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(process.env.USER_PASSWORD_HASH).toBeDefined();
  });

  it('POST /api/auth/setup should fail if users already exist', async () => {
    (db.select as Mock).mockReturnValueOnce(createMockQueryBuilder([{ id: 'existing' }]));
    const res = await app.handle(
      new Request('http://localhost/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 't@t.com', password: 'p123' })
      })
    );
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login should work with correct credentials', async () => {
    process.env.USER_PASSWORD_HASH = undefined;
    (db.select as Mock).mockReturnValueOnce(createMockQueryBuilder([]));
    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'u1', email: 't@t.com' }]),
      _brand: 'PgInsert',
      [Symbol.toStringTag]: 'PgInsert'
    };
    (db.insert as Mock).mockReturnValue(mockInsertChain);
    await app.handle(
      new Request('http://localhost/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 't@t.com', password: 'p123' })
      })
    );

    (db.select as Mock).mockReturnValueOnce(
      createMockQueryBuilder([{ id: 'u1', email: 't@t.com' }])
    );
    const res = await app.handle(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 't@t.com', password: 'p123' })
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('u1');
  });

  it('POST /api/auth/login should fail with invalid credentials', async () => {
    (db.select as Mock).mockReturnValueOnce(
      createMockQueryBuilder([{ id: 'u1', email: 't@t.com' }])
    );
    const res = await app.handle(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 't@t.com', password: 'wrong' })
      })
    );
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me should return 401 if user not found in DB', async () => {
    const signerApp = new Elysia()
      .use(jwt(JWT_CONFIG))
      .get('/sign', ({ jwt }) => jwt.sign({ userId: 'missing' }));
    const signRes = await signerApp.handle(new Request('http://localhost/sign'));
    const token = await signRes.text();

    (db.select as Mock).mockReturnValueOnce(createMockQueryBuilder([]));
    const req = new Request('http://localhost/api/auth/me');
    req.headers.append('Cookie', `auth=${token}`);
    const res = await app.handle(req);
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/auto-login should return 404 if no users', async () => {
    (db.select as Mock).mockReturnValue(createMockQueryBuilder([]));
    const res = await app.handle(
      new Request('http://localhost/api/auth/auto-login', { method: 'POST' })
    );
    expect(res.status).toBe(404);
  });

  it('POST /api/auth/auto-login should login first user', async () => {
    (db.select as Mock).mockReturnValue(createMockQueryBuilder([{ id: 'u1', email: 't@t.com' }]));
    const res = await app.handle(
      new Request('http://localhost/api/auth/auto-login', { method: 'POST' })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('u1');
  });
});
