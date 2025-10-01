import { createHash, randomBytes } from 'crypto';
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../../../drizzle/schema';

// OIDC configuration
const OIDC_CONFIG = {
  issuer: process.env.OIDC_ISSUER || '',
  clientId: process.env.OIDC_CLIENT_ID || '',
  clientSecret: process.env.OIDC_CLIENT_SECRET || '',
  redirectUri: process.env.OIDC_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
  scope: 'openid profile email'
};

// Generate PKCE challenge
function generatePKCE() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// OAuth state store (in production, use Redis or database)
const stateStore = new Map<string, { verifier: string; space: string; returnUrl: string }>();

export const oidcAuth = new Elysia()
  .decorate('db', db)
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'your-secret-key',
      exp: '7d'
    })
  )
  // Initiate OAuth flow
  .get(
    '/api/auth/login',
    ({ query, set, cookie: _cookie }) => {
      const { space = 'work', returnUrl = '/' } = query;

      // Generate state and PKCE
      const state = randomBytes(16).toString('base64url');
      const { verifier, challenge } = generatePKCE();

      // Store state data
      stateStore.set(state, { verifier, space, returnUrl });

      // Build authorization URL
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: OIDC_CONFIG.clientId,
        redirect_uri: OIDC_CONFIG.redirectUri,
        scope: OIDC_CONFIG.scope,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256'
      });

      const authUrl = `${OIDC_CONFIG.issuer}/protocol/openid-connect/auth?${params}`;

      set.status = 302;
      set.headers['Location'] = authUrl;
      return;
    },
    {
      query: t.Object({
        space: t.Optional(t.String()),
        returnUrl: t.Optional(t.String())
      })
    }
  )
  // OAuth callback
  .get(
    '/api/auth/callback',
    async ({ query, set, cookie, db, jwt }) => {
      const { code, state } = query;

      if (!code || !state) {
        set.status = 400;
        return { error: 'Missing code or state' };
      }

      // Verify state
      const stateData = stateStore.get(state);
      if (!stateData) {
        set.status = 400;
        return { error: 'Invalid state' };
      }

      stateStore.delete(state);
      const { verifier, space, returnUrl } = stateData;

      try {
        // Exchange code for tokens
        const tokenResponse = await fetch(`${OIDC_CONFIG.issuer}/protocol/openid-connect/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: OIDC_CONFIG.redirectUri,
            client_id: OIDC_CONFIG.clientId,
            client_secret: OIDC_CONFIG.clientSecret,
            code_verifier: verifier
          })
        });

        if (!tokenResponse.ok) {
          throw new Error('Token exchange failed');
        }

        const tokens = await tokenResponse.json();

        // Get user info
        const userInfoResponse = await fetch(
          `${OIDC_CONFIG.issuer}/protocol/openid-connect/userinfo`,
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`
            }
          }
        );

        if (!userInfoResponse.ok) {
          throw new Error('Failed to fetch user info');
        }

        const userInfo = await userInfoResponse.json();

        // Find or create user
        let [user] = await db.select().from(users).where(eq(users.email, userInfo.email));

        if (!user) {
          [user] = await db
            .insert(users)
            .values({
              email: userInfo.email,
              name: userInfo.name || userInfo.email
            })
            .returning();
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
          maxAge: 7 * 86400, // 7 days
          path: '/'
        });

        // Store user preference
        cookie.space.set({
          value: space,
          maxAge: 30 * 86400,
          path: '/'
        });

        // Redirect to return URL
        set.status = 302;
        set.headers['Location'] = returnUrl;
        return;
      } catch (error) {
        console.error('OAuth error:', error);
        set.status = 500;
        return { error: 'Authentication failed' };
      }
    },
    {
      query: t.Object({
        code: t.Optional(t.String()),
        state: t.Optional(t.String()),
        error: t.Optional(t.String())
      })
    }
  )
  // Logout
  .post('/api/auth/logout', ({ cookie, set }) => {
    const token = cookie.auth.value;
    cookie.auth.remove();

    // Build OIDC logout URL
    const logoutUrl = `${OIDC_CONFIG.issuer}/protocol/openid-connect/logout?${new URLSearchParams({
      post_logout_redirect_uri: process.env.FRONTEND_URL || 'http://localhost:3000',
      id_token_hint: token as string
    })}`;

    // Redirect to OIDC logout
    set.status = 302;
    set.headers['Location'] = logoutUrl;
    return;
  })
  // Get current user
  .get('/api/auth/me', async ({ cookie, jwt, db, set }) => {
    const token = cookie.auth.value;

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
  // Refresh token
  .post('/api/auth/refresh', async ({ cookie, jwt, set }) => {
    const token = cookie.auth.value;

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

      // Issue new token
      const newToken = await jwt.sign({
        userId: payload.userId,
        email: payload.email,
        name: payload.name
      });

      cookie.auth.set({
        value: newToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 86400,
        path: '/'
      });

      return { success: true };
    } catch {
      set.status = 401;
      return { error: 'Invalid token' };
    }
  });
