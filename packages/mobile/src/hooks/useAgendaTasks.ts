import { useQuery } from '@tanstack/react-query'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns'
import { useSpaceStore } from '@/store/spaceStore'
import { getStoredAccessToken } from '@/store/authStore'
import { API_URL } from '@/api/client'
import type { CalendarEvent } from '@/types'

export const useAgendaTasks = (view: 'day' | 'week', date: Date = new Date()) => {
  const { currentSpace } = useSpaceStore()

  const startDate = view === 'day' ? startOfDay(date) : startOfWeek(date)
  const endDate = view === 'day' ? endOfDay(date) : endOfWeek(date)

  return useQuery({
    queryKey: ['agenda', view, format(date, 'yyyy-MM-dd'), currentSpace],
    queryFn: async (): Promise<CalendarEvent[]> => {
      const token = await getStoredAccessToken()
      if (!token) throw new Error('Not authenticated')

      const response = await fetch(
        `${API_URL}/api/calendar/events?start=${startDate.getTime()}&end=${endDate.getTime()}&space=${currentSpace}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch tasks')
      }

      return response.json()
    },
    enabled: !!currentSpace,
  })
}
