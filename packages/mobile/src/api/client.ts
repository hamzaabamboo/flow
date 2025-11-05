import { edenTreaty } from '@elysiajs/eden';
import { getStoredAccessToken, useAuthStore } from '@/store/authStore';
import type { App } from '../../../../src/server';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3000';

// Global 401 handler
export const handle401 = async () => {
  console.error('[API] 401 Unauthorized - logging out');
  const { logout } = useAuthStore.getState();
  await logout();
};

// TODO: Import server types once monorepo is properly linked

// For now, use any - will be replaced with proper types
//@ts-expect-error elysia thing idk
export const api = edenTreaty<App>(API_URL, {
  $fetch: {
    headers: async () => {
      const token = await getStoredAccessToken();
      console.log('[API Client] Token:', token ? `${token.substring(0, 20)}...` : 'NONE');
      return {
        Authorization: token ? `Bearer ${token}` : ''
      };
    }
  }
});

export { API_URL, WS_URL };
