import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import { eq } from 'drizzle-orm';
import { users } from '../../../drizzle/schema';
import { db } from '../db';

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export const authMiddleware = new Elysia({ name: 'auth-middleware' })
  .decorate('db', db)
  .use(cookie())
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'your-secret-key'
    })
  )
  .derive(async ({ cookie, jwt, db, set }) => {
    const token = cookie.auth?.value;

    if (!token) {
      set.status = 401;
      throw new Error('Authentication required');
    }

    try {
      const payload = await jwt.verify(token as string);

      if (!payload || !payload.userId) {
        set.status = 401;
        throw new Error('Invalid token');
      }

      // Get user from database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId as string));

      if (!user) {
        set.status = 401;
        throw new Error('User not found');
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        } as AuthUser
      };
    } catch {
      set.status = 401;
      throw new Error('Authentication failed');
    }
  });

// Optional auth middleware (doesn't throw error if not authenticated)
export const optionalAuthMiddleware = new Elysia({ name: 'optional-auth' })
  .decorate('db', db)
  .use(cookie())
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'your-secret-key'
    })
  )
  .derive(async ({ cookie, jwt, db }) => {
    const token = cookie.auth?.value;

    if (!token) {
      return { user: null };
    }

    try {
      const payload = await jwt.verify(token as string);

      if (!payload || !payload.userId) {
        return { user: null };
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId as string));

      if (!user) {
        return { user: null };
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        } as AuthUser
      };
    } catch {
      return { user: null };
    }
  });
