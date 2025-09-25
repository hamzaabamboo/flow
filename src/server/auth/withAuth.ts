import { Elysia } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import { eq } from 'drizzle-orm';
import { users } from '../../../drizzle/schema';
import { db } from '../db';

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

// Create a function that returns an Elysia instance with auth context
export const withAuth = () =>
  new Elysia()
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
      } catch (_error) {
        set.status = 401;
        throw new Error('Authentication failed');
      }
    });
