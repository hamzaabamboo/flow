import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { refreshAccessToken, revokeToken, type HamAuthTokens } from '@/auth/hamauth'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  userEmail: string | null
  userName: string | null
  setTokens: (tokens: HamAuthTokens, userInfo?: { email: string; name?: string }) => Promise<void>
  loadTokens: () => Promise<void>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<boolean>
  checkAndRefreshToken: () => Promise<boolean>
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_EMAIL: 'user_email',
  USER_NAME: 'user_name',
  TOKEN_EXPIRY: 'token_expiry',
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true, // Start as loading until we check SecureStore
  userEmail: null,
  userName: null,

  setTokens: async (tokens: HamAuthTokens, userInfo?: { email: string; name?: string }) => {
    try {
      console.log('[AuthStore] Setting tokens...', { userEmail: userInfo?.email, expiresIn: tokens.expiresIn })
      // Store access token
      await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken)

      // Store refresh token if available
      if (tokens.refreshToken) {
        await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken)
      }

      // Store token expiry time (current time + expiresIn seconds)
      if (tokens.expiresIn) {
        const expiryTime = Date.now() + tokens.expiresIn * 1000
        await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString())
        console.log('[AuthStore] Token will expire at:', new Date(expiryTime).toISOString())
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
        isLoading: false,
        userEmail: userInfo?.email || null,
        userName: userInfo?.name || null,
      })
      console.log('[AuthStore] Tokens saved successfully, isAuthenticated: true, isLoading: false')
    } catch (error) {
      console.error('[AuthStore] Failed to store tokens:', error)
      throw error
    }
  },

  loadTokens: async () => {
    try {
      console.log('[AuthStore] Loading tokens from SecureStore...')
      set({ isLoading: true })

      const [accessToken, refreshToken, userEmail, userName, tokenExpiry] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
        SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
        SecureStore.getItemAsync(STORAGE_KEYS.USER_EMAIL),
        SecureStore.getItemAsync(STORAGE_KEYS.USER_NAME),
        SecureStore.getItemAsync(STORAGE_KEYS.TOKEN_EXPIRY),
      ])

      // Check if token is expired
      const isExpired = tokenExpiry ? Date.now() > parseInt(tokenExpiry) : false
      console.log('[AuthStore] Token status:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        isExpired,
        expiresAt: tokenExpiry ? new Date(parseInt(tokenExpiry)).toISOString() : 'unknown',
        userEmail
      })

      // If token is expired and we have a refresh token, try to refresh
      if (isExpired && refreshToken) {
        console.log('[AuthStore] Token expired, attempting to refresh...')
        const { refreshAccessToken } = get()
        const refreshed = await refreshAccessToken()

        if (refreshed) {
          console.log('[AuthStore] Token refreshed successfully')
          return // refreshAccessToken already sets the state
        } else {
          console.log('[AuthStore] Token refresh failed, clearing auth state')
          // Clear everything if refresh failed
          set({
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            userEmail: null,
            userName: null,
          })
          return
        }
      }

      // If token is expired and no refresh token, clear auth
      if (isExpired) {
        console.log('[AuthStore] Token expired with no refresh token, clearing auth')
        set({
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          userEmail: null,
          userName: null,
        })
        return
      }

      const isAuthenticated = !!accessToken
      set({
        accessToken,
        refreshToken,
        isAuthenticated,
        isLoading: false,
        userEmail,
        userName,
      })
    } catch (error) {
      console.error('[AuthStore] Failed to load tokens:', error)
      set({
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        userEmail: null,
        userName: null,
      })
    }
  },

  refreshAccessToken: async () => {
    const { refreshToken: storedRefreshToken } = get()

    if (!storedRefreshToken) {
      console.error('[AuthStore] No refresh token available')
      return false
    }

    try {
      console.log('[AuthStore] Refreshing access token...')
      const newTokens = await refreshAccessToken(storedRefreshToken)

      if (!newTokens) {
        console.error('[AuthStore] Failed to refresh token - no tokens returned')
        return false
      }

      // Update stored tokens
      await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, newTokens.accessToken)
      if (newTokens.refreshToken) {
        await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, newTokens.refreshToken)
      }

      // Update expiry time
      if (newTokens.expiresIn) {
        const expiryTime = Date.now() + newTokens.expiresIn * 1000
        await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString())
        console.log('[AuthStore] New token will expire at:', new Date(expiryTime).toISOString())
      }

      set({
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken || storedRefreshToken,
        isAuthenticated: true,
        isLoading: false,
      })

      console.log('[AuthStore] Token refreshed successfully')
      return true
    } catch (error) {
      console.error('[AuthStore] Error refreshing access token:', error)
      return false
    }
  },

  checkAndRefreshToken: async () => {
    const tokenExpiry = await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN_EXPIRY)

    if (!tokenExpiry) {
      console.log('[AuthStore] No token expiry found')
      return false
    }

    const expiryTime = parseInt(tokenExpiry)
    const now = Date.now()
    const timeUntilExpiry = expiryTime - now

    // If token expires in less than 1 minute, refresh it proactively
    if (timeUntilExpiry < 60 * 1000) {
      console.log('[AuthStore] Token expiring soon, refreshing proactively')
      const { refreshAccessToken } = get()
      return await refreshAccessToken()
    }

    return true
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
      SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN_EXPIRY),
      SecureStore.deleteItemAsync(STORAGE_KEYS.USER_EMAIL),
      SecureStore.deleteItemAsync(STORAGE_KEYS.USER_NAME),
    ])

    set({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      userEmail: null,
      userName: null,
    })
  },
}))

// Helper function for API client
export const getStoredAccessToken = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN)
    console.log('[getStoredAccessToken] Token retrieved:', token ? `${token.substring(0, 20)}...` : 'NULL')
    return token
  } catch (error) {
    console.error('[getStoredAccessToken] Error:', error)
    return null
  }
}
