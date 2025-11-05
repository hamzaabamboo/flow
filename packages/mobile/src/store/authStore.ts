import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { refreshAccessToken, revokeToken, type HamAuthTokens } from '@/auth/hamauth'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  userEmail: string | null
  userName: string | null
  setTokens: (tokens: HamAuthTokens, userInfo?: { email: string; name?: string }) => Promise<void>
  loadTokens: () => Promise<void>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<boolean>
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_EMAIL: 'user_email',
  USER_NAME: 'user_name',
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  userEmail: null,
  userName: null,

  setTokens: async (tokens: HamAuthTokens, userInfo?: { email: string; name?: string }) => {
    try {
      console.log('[AuthStore] Setting tokens...', { userEmail: userInfo?.email })
      // Store access token
      await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken)

      // Store refresh token if available
      if (tokens.refreshToken) {
        await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken)
      }

      // Store user info if provided
      if (userInfo) {
        await SecureStore.setItemAsync(STORAGE_KEYS.USER_EMAIL, userInfo.email)
        if (userInfo.name) {
          await SecureStore.setItemAsync(STORAGE_KEYS.USER_NAME, userInfo.name)
        }
      }

      set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || null,
        isAuthenticated: true,
        userEmail: userInfo?.email || null,
        userName: userInfo?.name || null,
      })
      console.log('[AuthStore] Tokens saved successfully, isAuthenticated: true')
    } catch (error) {
      console.error('[AuthStore] Failed to store tokens:', error)
      throw error
    }
  },

  loadTokens: async () => {
    try {
      console.log('[AuthStore] Loading tokens...')
      const [accessToken, refreshToken, userEmail, userName] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
        SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
        SecureStore.getItemAsync(STORAGE_KEYS.USER_EMAIL),
        SecureStore.getItemAsync(STORAGE_KEYS.USER_NAME),
      ])

      const isAuthenticated = !!accessToken
      console.log('[AuthStore] Tokens loaded:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        userEmail,
        isAuthenticated
      })

      set({
        accessToken,
        refreshToken,
        isAuthenticated,
        userEmail,
        userName,
      })
    } catch (error) {
      console.error('[AuthStore] Failed to load tokens:', error)
      set({
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        userEmail: null,
        userName: null,
      })
    }
  },

  refreshAccessToken: async () => {
    const { refreshToken: storedRefreshToken } = get()

    if (!storedRefreshToken) {
      console.error('No refresh token available')
      return false
    }

    try {
      const newTokens = await refreshAccessToken(storedRefreshToken)

      if (!newTokens) {
        console.error('Failed to refresh token')
        return false
      }

      // Update stored tokens
      await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, newTokens.accessToken)
      if (newTokens.refreshToken) {
        await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, newTokens.refreshToken)
      }

      set({
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken || storedRefreshToken,
      })

      return true
    } catch (error) {
      console.error('Error refreshing access token:', error)
      return false
    }
  },

  logout: async () => {
    const { accessToken, refreshToken: storedRefreshToken } = get()

    // Attempt to revoke tokens
    if (accessToken) {
      await revokeToken(accessToken)
    }
    if (storedRefreshToken) {
      await revokeToken(storedRefreshToken)
    }

    // Clear all stored data
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.USER_EMAIL),
      SecureStore.deleteItemAsync(STORAGE_KEYS.USER_NAME),
    ])

    set({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      userEmail: null,
      userName: null,
    })
  },
}))

// Helper function for API client
export const getStoredAccessToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN)
  } catch {
    return null
  }
}
