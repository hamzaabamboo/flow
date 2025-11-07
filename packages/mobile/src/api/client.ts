import { getStoredAccessToken, useAuthStore } from '@/store/authStore';
import type { App } from '../../../../src/server';
import { treaty } from '@elysiajs/eden';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3000';

// Track if we're currently refreshing to avoid multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// Global 401 handler
export const handle401 = async () => {
  console.error('[API] 401 Unauthorized - logging out');
  const { logout } = useAuthStore.getState();
  await logout();
};

// Custom fetch wrapper that adds auth headers and handles token refresh
const customFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const token = await getStoredAccessToken();
  console.log('[API Client] Token:', token ? `${token.substring(0, 20)}...` : 'NONE');

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  console.log('[API Client] Request URL:', url);
  console.log('[API Client] Request headers:', Object.fromEntries(headers.entries()));

  const response = await fetch(url, {
    ...init,
    headers
  });

  // If we get a 401, try to refresh the token and retry once
  if (response.status === 401 && !init?.headers?.['X-Retry-After-Refresh']) {
    console.log('[API Client] Got 401, attempting token refresh...');

    // If another request is already refreshing, wait for it
    if (isRefreshing && refreshPromise) {
      console.log('[API Client] Waiting for ongoing refresh...');
      await refreshPromise;
    } else {
      // Start a new refresh
      isRefreshing = true;
      refreshPromise = (async () => {
        try {
          const { checkAndRefreshToken } = useAuthStore.getState();
          const refreshed = await checkAndRefreshToken();
          return refreshed;
        } finally {
          isRefreshing = false;
          refreshPromise = null;
        }
      })();

      const refreshed = await refreshPromise;

      if (!refreshed) {
        console.log('[API Client] Token refresh failed, returning 401');
        return response;
      }
    }

    // Retry the request with the new token
    console.log('[API Client] Retrying request with refreshed token...');
    const newToken = await getStoredAccessToken();
    const retryHeaders = new Headers(init?.headers);
    if (newToken) {
      retryHeaders.set('Authorization', `Bearer ${newToken}`);
    }
    // Mark that this is a retry to avoid infinite loops
    retryHeaders.set('X-Retry-After-Refresh', 'true');

    return fetch(url, {
      ...init,
      headers: retryHeaders
    });
  }

  return response;
};

export const api = treaty<App>(API_URL, {
  fetcher: customFetch as typeof fetch
});

export { API_URL, WS_URL };
