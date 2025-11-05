/**
 * HamAuth OIDC Configuration and Utilities
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Enable web browser to properly close after authentication
WebBrowser.maybeCompleteAuthSession();

// HamAuth OIDC Configuration
export const HAMAUTH_CONFIG = {
  issuer: 'https://auth.ham-san.net/realms/ham-auth',
  clientId: 'ham-flow-mobile',
  // For mobile, we don't need client secret (PKCE is used instead)
  scopes: ['openid', 'profile', 'email'],
};

// OIDC Endpoints (derived from issuer)
export const OIDC_ENDPOINTS = {
  authorization: `${HAMAUTH_CONFIG.issuer}/protocol/openid-connect/auth`,
  token: `${HAMAUTH_CONFIG.issuer}/protocol/openid-connect/token`,
  userInfo: `${HAMAUTH_CONFIG.issuer}/protocol/openid-connect/userinfo`,
  revocation: `${HAMAUTH_CONFIG.issuer}/protocol/openid-connect/revoke`,
};

export interface HamAuthUserInfo {
  sub: string; // Subject (unique user ID)
  email: string;
  name?: string;
  email_verified?: boolean;
  preferred_username?: string;
}

export interface HamAuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number; // seconds
  tokenType: string;
}

/**
 * Create OAuth discovery configuration
 */
export const createDiscovery = (): AuthSession.DiscoveryDocument => ({
  authorizationEndpoint: OIDC_ENDPOINTS.authorization,
  tokenEndpoint: OIDC_ENDPOINTS.token,
  revocationEndpoint: OIDC_ENDPOINTS.revocation,
});

/**
 * Perform OIDC login flow
 * @param redirectUri - The redirect URI (from expo-auth-session)
 * @returns Authentication result with tokens
 */
export async function performOIDCLogin(
  redirectUri: string
): Promise<HamAuthTokens | null> {
  try {
    const discovery = createDiscovery();

    // Create authorization request with PKCE
    const authRequestConfig: AuthSession.AuthRequestConfig = {
      clientId: HAMAUTH_CONFIG.clientId,
      scopes: HAMAUTH_CONFIG.scopes,
      redirectUri,
      usePKCE: true, // PKCE for mobile security
      responseType: AuthSession.ResponseType.Code,
    };

    const authRequest = new AuthSession.AuthRequest(authRequestConfig);

    // Perform authorization
    const result = await authRequest.promptAsync(discovery);

    if (result.type !== 'success') {
      console.error('OIDC login failed:', result.type);
      return null;
    }

    // Exchange authorization code for tokens
    const tokenResult = await AuthSession.exchangeCodeAsync(
      {
        clientId: HAMAUTH_CONFIG.clientId,
        code: result.params.code,
        redirectUri,
        extraParams: {
          code_verifier: authRequest.codeVerifier || '',
        },
      },
      discovery
    );

    return {
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      idToken: tokenResult.idToken,
      expiresIn: tokenResult.expiresIn,
      tokenType: tokenResult.tokenType || 'Bearer',
    };
  } catch (error) {
    console.error('OIDC login error:', error);
    return null;
  }
}

/**
 * Fetch user information from HamAuth
 * @param accessToken - The access token
 * @returns User information
 */
export async function fetchUserInfo(
  accessToken: string
): Promise<HamAuthUserInfo | null> {
  try {
    const response = await fetch(OIDC_ENDPOINTS.userInfo, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch user info:', response.status);
      return null;
    }

    const userInfo = (await response.json()) as HamAuthUserInfo;

    if (!userInfo.email) {
      console.error('User info missing email');
      return null;
    }

    return userInfo;
  } catch (error) {
    console.error('Error fetching user info:', error);
    return null;
  }
}

/**
 * Refresh access token using refresh token
 * @param refreshToken - The refresh token
 * @returns New tokens
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<HamAuthTokens | null> {
  try {
    const discovery = createDiscovery();

    const tokenResult = await AuthSession.refreshAsync(
      {
        clientId: HAMAUTH_CONFIG.clientId,
        refreshToken,
      },
      discovery
    );

    return {
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      idToken: tokenResult.idToken,
      expiresIn: tokenResult.expiresIn,
      tokenType: tokenResult.tokenType || 'Bearer',
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

/**
 * Revoke tokens (logout)
 * @param token - The token to revoke (access or refresh)
 */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const discovery = createDiscovery();

    await AuthSession.revokeAsync(
      {
        clientId: HAMAUTH_CONFIG.clientId,
        token,
      },
      discovery
    );

    return true;
  } catch (error) {
    console.error('Error revoking token:', error);
    return false;
  }
}
