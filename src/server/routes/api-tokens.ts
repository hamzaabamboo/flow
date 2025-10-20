import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { withAuth } from '../auth/withAuth';
import { apiTokens } from '../../../drizzle/schema';

// Function to generate a random API token
function generateApiToken(): string {
  return randomBytes(32).toString('hex');
}

// Simple hash function using crypto (for Bun compatibility)
async function hashToken(token: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(token);
  return hasher.digest('hex');
}

export const apiTokensRoutes = new Elysia({ prefix: '/api-tokens' })
  .use(withAuth())
  // List user's API tokens
  .get('/', async ({ db, user }) => {
    const tokens = await db
      .select({
        id: apiTokens.id,
        name: apiTokens.name,
        lastUsedAt: apiTokens.lastUsedAt,
        expiresAt: apiTokens.expiresAt,
        createdAt: apiTokens.createdAt
      })
      .from(apiTokens)
      .where(eq(apiTokens.userId, user.id));

    return tokens;
  })
  // Create new API token
  .post(
    '/',
    async ({ body, db, user }) => {
      const rawToken = generateApiToken();
      const hashedToken = await hashToken(rawToken);

      const [newToken] = await db
        .insert(apiTokens)
        .values({
          userId: user.id,
          name: body.name,
          token: hashedToken,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null
        })
        .returning({
          id: apiTokens.id,
          name: apiTokens.name,
          createdAt: apiTokens.createdAt
        });

      // Return the unhashed token only once
      return {
        ...newToken,
        token: rawToken
      };
    },
    {
      body: t.Object({
        name: t.String(),
        expiresAt: t.Optional(t.String())
      })
    }
  )
  // Delete/revoke API token
  .delete(
    '/:id',
    async ({ params, db, user }) => {
      const [deleted] = await db.delete(apiTokens).where(eq(apiTokens.id, params.id)).returning();

      // Verify the token belongs to the user
      if (deleted && deleted.userId !== user.id) {
        throw new Error('Unauthorized');
      }

      return { success: true, id: deleted.id };
    },
    {
      params: t.Object({ id: t.String() })
    }
  );
