import { Elysia } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import { eq, asc } from 'drizzle-orm';
import { users, apiTokens } from '../../../drizzle/schema';
import { db } from '../db';
import { logger } from '../logger';

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

// Hash function for API token verification
async function hashToken(token: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(token);
  return hasher.digest('hex');
}

// Create a function that returns an Elysia instance with auth context
export const withAuth = () =>
  new Elysia()
    .decorate('db', db)
    .decorate('logger', logger)
    .use(cookie())
    .use(
      jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET || 'your-secret-key'
      })
    )
    .derive({ as: 'global' }, async ({ cookie, jwt, db, set, request }) => {
      // Check for Bearer token in Authorization header first
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const rawToken = authHeader.substring(7);
        const hashedToken = await hashToken(rawToken);

        // Look up token in database
        const [tokenRecord] = await db
          .select()
          .from(apiTokens)
          .where(eq(apiTokens.token, hashedToken));

        if (tokenRecord) {
          // Check if token is expired
          if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
            set.status = 401;
            throw new Error('API token expired');
          }

          // Get user
          const [user] = await db.select().from(users).where(eq(users.id, tokenRecord.userId));

          if (user) {
            // Update last used timestamp (fire and forget)
            db.update(apiTokens)
              .set({ lastUsedAt: new Date() })
              .where(eq(apiTokens.id, tokenRecord.id))
              .execute()
              .catch(() => {
                // Ignore update failures
              });

            return {
              user: {
                id: user.id,
                email: user.email,
                name: user.name
              } as AuthUser
            };
          }
        }

        // Invalid API token
        set.status = 401;
        throw new Error('Invalid API token');
      }

      // Fall back to JWT cookie authentication
      const token = cookie.auth?.value;

      // Auto-login in development if no token
      if (!token && process.env.NODE_ENV !== 'production') {
        logger.info('No auth token found - auto-logging in as first user (development mode)');

        // Get the first user from database (ordered by creation date)
        const [firstUser] = await db.select().from(users).orderBy(asc(users.createdAt)).limit(1);

        if (firstUser) {
          // Create JWT token for this user
          const autoToken = await jwt.sign({
            userId: firstUser.id,
            email: firstUser.email,
            name: firstUser.name
          });

          // Set cookie
          cookie.auth.set({
            value: autoToken,
            httpOnly: true,
            secure: false, // Development
            sameSite: 'lax',
            maxAge: 30 * 86400, // 30 days
            path: '/'
          });

          // Set a non-httpOnly cookie for WebSocket authentication
          cookie.ws_token.set({
            value: autoToken,
            httpOnly: false, // Allow JavaScript access for WebSocket
            secure: false, // Development
            sameSite: 'lax',
            maxAge: 30 * 86400, // 30 days
            path: '/'
          });

          logger.info(`Auto-logged in as: ${firstUser.email}`);

          return {
            user: {
              id: firstUser.id,
              email: firstUser.email,
              name: firstUser.name
            } as AuthUser
          };
        }
      }

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

        // Ensure ws_token is set for WebSocket authentication
        if (!cookie.ws_token.value) {
          cookie.ws_token.set({
            value: token as string,
            httpOnly: false, // Allow JavaScript access for WebSocket
            secure: false, // Development
            sameSite: 'lax',
            maxAge: 30 * 86400, // 30 days
            path: '/'
          });
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
