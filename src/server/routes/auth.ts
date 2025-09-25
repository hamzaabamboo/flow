import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../../../drizzle/schema';

// This will integrate with HamCloud auth
export const authRoutes = new Elysia({ prefix: '/auth' })
  .decorate('db', db)
  // Login via HamCloud
  .post(
    '/login',
    async ({ body, db, cookie }) => {
      // TODO: Integrate with HamCloud OAuth
      // For now, simple email-based auth for development

      const [user] = await db.select().from(users).where(eq(users.email, body.email));

      if (!user) {
        // Create user if doesn't exist
        const [newUser] = await db
          .insert(users)
          .values({
            email: body.email,
            name: body.name
          })
          .returning();

        // Set cookie
        cookie.auth.set({
          value: JSON.stringify({ userId: newUser.id, email: newUser.email }),
          httpOnly: true,
          maxAge: 7 * 86400,
          path: '/'
        });

        return newUser;
      }

      // Set cookie
      cookie.auth.set({
        value: JSON.stringify({ userId: user.id, email: user.email }),
        httpOnly: true,
        maxAge: 7 * 86400,
        path: '/'
      });

      return user;
    },
    {
      body: t.Object({
        email: t.String(),
        name: t.Optional(t.String())
      })
    }
  )
  // Logout
  .post('/logout', ({ cookie }) => {
    cookie.auth.remove();
    return { success: true };
  })
  // Get current user
  .get('/me', ({ cookie }) => {
    const authCookie = cookie.auth.value;

    if (!authCookie) {
      throw new Error('Not authenticated');
    }

    try {
      const user = JSON.parse(authCookie as string);
      return user;
    } catch {
      throw new Error('Invalid auth cookie');
    }
  });
