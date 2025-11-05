import { useQuery } from '@tanstack/react-query'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { useSpaceStore } from '@/store/spaceStore'
import { getStoredAccessToken, useAuthStore } from '@/store/authStore'
import { API_URL } from '@/api/client'
import type { CalendarEvent } from '@/types'

export const useAgendaTasks = (view: 'day' | 'week', date: Date = new Date()) => {
  const { currentSpace } = useSpaceStore()
  const router = useRouter()
  const logout = useAuthStore((state) => state.logout)
  const refreshAccessToken = useAuthStore((state) => state.refreshAccessToken)
  const checkAndRefreshToken = useAuthStore((state) => state.checkAndRefreshToken)

  const startDate = view === 'day' ? startOfDay(date) : startOfWeek(date)
  const endDate = view === 'day' ? endOfDay(date) : endOfWeek(date)

  console.log('[useAgendaTasks] Hook params:', {
    view,
    currentSpace,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  })

  const query = useQuery({
    queryKey: ['agenda', view, format(date, 'yyyy-MM-dd'), currentSpace],
    queryFn: async (): Promise<CalendarEvent[]> => {
      console.log('[useAgendaTasks] Fetching tasks...', { view, currentSpace, API_URL })

      // Check if token is about to expire and refresh proactively
      await checkAndRefreshToken()

      const token = await getStoredAccessToken()

      console.log('[useAgendaTasks] Token retrieved from store:', token ? `${token.substring(0, 20)}...` : 'NULL')

      if (!token) {
        console.error('[useAgendaTasks] No token found!')
        throw new Error('Not authenticated')
      }

      const startTimestamp = Math.floor(startDate.getTime() / 1000)
      const endTimestamp = Math.floor(endDate.getTime() / 1000)
      const url = `${API_URL}/api/calendar/events?start=${startTimestamp}&end=${endTimestamp}&space=${currentSpace}&includeOverdue=true`
      console.log('[useAgendaTasks] Request URL:', url)
      console.log('[useAgendaTasks] Authorization header:', `Bearer ${token.substring(0, 20)}...`)

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      console.log('[useAgendaTasks] Response status:', response.status)

      if (response.status === 401) {
        console.error('[useAgendaTasks] 401 Unauthorized - attempting token refresh')
        // Try to refresh the token
        const refreshed = await refreshAccessToken()

        if (refreshed) {
          console.log('[useAgendaTasks] Token refreshed successfully, retrying request')
          // Get the new token and retry the request
          const newToken = await getStoredAccessToken()
          if (newToken) {
            const retryResponse = await fetch(url, {
              headers: {
                Authorization: `Bearer ${newToken}`,
                'Content-Type': 'application/json',
              },
            })

            if (retryResponse.ok) {
              const data = await retryResponse.json()
              console.log('[useAgendaTasks] Retry successful, received tasks:', data.length)
              return data
            }
          }
        }

        // Refresh failed or retry failed, logout and redirect
        console.error('[useAgendaTasks] Token refresh failed, logging out')
        await logout()
        router.replace('/(auth)/login')
        throw new Error('Session expired, please login again')
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[useAgendaTasks] Failed to fetch tasks:', response.status, errorText)
        throw new Error(`${response.status} ${errorText}`)
      }

      const data = await response.json()
      console.log('[useAgendaTasks] Received tasks:', data.length, 'tasks')
      return data
    },
    enabled: !!currentSpace,
    retry: (failureCount, error) => {
      // Don't retry on 401
      if (error.message.includes('Session expired')) {
        return false
      }
      return failureCount < 3
    }
  })

  return query
}
