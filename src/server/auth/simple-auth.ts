import { createHash } from 'crypto';
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { eq } from 'drizzle-orm';
import { users } from '../../../drizzle/schema';
import { db } from '../db';

// Simple password hashing (in production, use bcrypt or argon2)
function hashPassword(password: string): string {
  return createHash('sha256')
    .update(password + process.env.JWT_SECRET)
    .digest('hex');
}

export const simpleAuth = new Elysia()
  .decorate('db', db)
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'your-secret-key-change-this',
      exp: '30d'
    })
  )
  // Setup initial user (run once)
  .post(
    '/api/auth/setup',
    async ({ body, db, set }) => {
      const { email, password, name } = body;

      // Check if any user exists
      const existingUsers = await db.select().from(users).limit(1);

      if (existingUsers.length > 0) {
        set.status = 400;
        return { error: 'User already exists' };
      }

      // Create the single user
      const passwordHash = hashPassword(password);

      const [_newUser] = await db
        .insert(users)
        .values({
          email,
          name: name || email
        })
        .returning();

      // Store password hash in env or separate secure storage
      // For simplicity, we'll use an environment variable
      process.env.USER_PASSWORD_HASH = passwordHash;

      return {
        success: true,
        message: 'User created successfully. Please add USER_PASSWORD_HASH to your .env file',
        passwordHash
      };
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String(),
        name: t.Optional(t.String())
      })
    }
  )
  // Simple login
  .post(
    '/api/auth/login',
    async ({ body, db, jwt, cookie, set }) => {
      const { email, password } = body;

      // Get user
      const [user] = await db.select().from(users).where(eq(users.email, email));

      if (!user) {
        set.status = 401;
        return { error: 'Invalid credentials' };
      }

      // Verify password
      const passwordHash = hashPassword(password);
      const storedHash = process.env.USER_PASSWORD_HASH;

      if (!storedHash || passwordHash !== storedHash) {
        set.status = 401;
        return { error: 'Invalid credentials' };
      }

      // Create JWT token
      const token = await jwt.sign({
        userId: user.id,
        email: user.email,
        name: user.name
      });

      // Set cookie
      cookie.auth.set({
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 86400, // 30 days
        path: '/'
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name
      };
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String()
      })
    }
  )
  // Logout
  .post('/api/auth/logout', ({ cookie }) => {
    cookie.auth.remove();
    return { success: true };
  })
  // Get current user
  .get('/api/auth/me', async ({ cookie, jwt, db, set }) => {
    const token = cookie.auth?.value;

    if (!token) {
      set.status = 401;
      return { error: 'Not authenticated' };
    }

    try {
      const payload = await jwt.verify(token as string);

      if (!payload) {
        set.status = 401;
        return { error: 'Invalid token' };
      }

      // Get fresh user data
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId as string));

      if (!user) {
        set.status = 401;
        return { error: 'User not found' };
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name
      };
    } catch {
      set.status = 401;
      return { error: 'Invalid token' };
    }
  })
  // Auto-login for single user (convenience endpoint)
  .post('/api/auth/auto-login', async ({ db, jwt, cookie, set }) => {
    // Get the single user
    const [user] = await db.select().from(users).limit(1);

    if (!user) {
      set.status = 404;
      return { error: 'No user found. Please run setup first.' };
    }

    // Create JWT token
    const token = await jwt.sign({
      userId: user.id,
      email: user.email,
      name: user.name
    });

    // Set cookie
    cookie.auth.set({
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 86400, // 30 days
      path: '/'
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name
    };
  });
