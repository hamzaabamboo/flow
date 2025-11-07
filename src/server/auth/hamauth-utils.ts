/**
 * Shared utilities for HamAuth (OIDC) integration
 * Used by both web login flow and API Bearer token validation
 */

// HamAuth OIDC configuration
export const HAMAUTH_CONFIG = {
  issuer: process.env.OIDC_ISSUER || '',
  clientId: process.env.OIDC_CLIENT_ID || '',
  clientSecret: process.env.OIDC_CLIENT_SECRET || '',
  userInfoEndpoint:
    process.env.OIDC_USERINFO_ENDPOINT ||
    `${process.env.OIDC_ISSUER}/protocol/openid-connect/userinfo`
};

export interface HamAuthUserInfo {
  sub: string; // Subject (unique user ID)
  email: string;
  name?: string;
  email_verified?: boolean;
  preferred_username?: string;
}

/**
 * Validate a HamAuth access token and get user information
 * @param accessToken - The HamAuth access token to validate
 * @returns User information if token is valid, null otherwise
 */
export async function validateHamAuthToken(accessToken: string): Promise<HamAuthUserInfo | null> {
  if (!HAMAUTH_CONFIG.issuer || !HAMAUTH_CONFIG.userInfoEndpoint) {
    console.warn('HamAuth not configured - OIDC_ISSUER not set');
    return null;
  }

  try {
    const userInfoResponse = await fetch(HAMAUTH_CONFIG.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!userInfoResponse.ok) {
      // Token is invalid or expired
      console.warn(
        `HamAuth token validation failed: ${userInfoResponse.status} ${userInfoResponse.statusText}`
      );
      return null;
    }

    const userInfo = (await userInfoResponse.json()) as HamAuthUserInfo;

    // Basic validation
    if (!userInfo.email) {
      console.error('HamAuth userinfo missing email');
      return null;
    }

    return userInfo;
  } catch (error) {
    console.error('Failed to validate HamAuth token:', error);
    return null;
  }
}

/**
 * In-memory cache for token validation results
 * Format: Map<token_hash, { userInfo, expiresAt }>
 */
interface CachedTokenInfo {
  userInfo: HamAuthUserInfo;
  expiresAt: number; // Unix timestamp
}

const tokenCache = new Map<string, CachedTokenInfo>();

// Cache tokens for 1 minute to avoid caching tokens that are about to expire
// HamAuth tokens typically expire in 5 minutes, so caching for 1 minute is safe
const CACHE_DURATION_MS = 1 * 60 * 1000;

/**
 * Clean up expired cache entries
 */
function cleanupCache() {
  const now = Date.now();
  for (const [token, info] of tokenCache.entries()) {
    if (info.expiresAt < now) {
      tokenCache.delete(token);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupCache, 60 * 1000);

/**
 * Simple hash function for cache keys (to avoid storing raw tokens)
 */
async function hashTokenForCache(token: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(token);
  return hasher.digest('hex');
}

/**
 * Validate HamAuth token with caching
 * @param accessToken - The HamAuth access token to validate
 * @returns User information if token is valid, null otherwise
 */
export async function validateHamAuthTokenCached(
  accessToken: string
): Promise<HamAuthUserInfo | null> {
  // Check cache first
  const cacheKey = await hashTokenForCache(accessToken);
  const cached = tokenCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.userInfo;
  }

  // Not in cache or expired - validate with HamAuth
  const userInfo = await validateHamAuthToken(accessToken);

  if (userInfo) {
    // Store in cache
    tokenCache.set(cacheKey, {
      userInfo,
      expiresAt: Date.now() + CACHE_DURATION_MS
    });
  } else {
    // Token is invalid - remove from cache to avoid checking again
    tokenCache.delete(cacheKey);
  }

  return userInfo;
}
