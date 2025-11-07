import { treaty } from '@elysiajs/eden';
import type { App } from './server';

// Get the API URL - in development it's the same origin, in production it should be configured
const API_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

// Custom fetch wrapper for cookie-based authentication
const customFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  // Ensure credentials are included for cookie-based auth
  const response = await fetch(url, {
    ...init,
    credentials: 'include'
  });

  // If we get a 401, the session is invalid - redirect to login
  if (response.status === 401 && typeof window !== 'undefined') {
    // Only redirect if we're not already on the login page
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  return response;
};

// Create and export the type-safe API client
export const api = treaty<App>(API_URL, {
  fetcher: customFetch as typeof fetch
});

export { API_URL };
