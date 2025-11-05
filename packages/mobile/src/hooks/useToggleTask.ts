import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { getStoredToken } from '@/store/authStore'
import { API_URL } from '@/api/client'

export const useToggleTask = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (taskId: string) => {
      const token = await getStoredToken()
      if (!token) throw new Error('Not authenticated')

      // First get the task to toggle its state
      const getResponse = await fetch(`${API_URL}/api/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!getResponse.ok) throw new Error('Failed to get task')

      const task = await getResponse.json()

      // Toggle completed state
      const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          completed: !task.completed,
        }),
      })

      if (!response.ok) throw new Error('Failed to toggle task')

      return response.json()
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (error) => {
      console.error('Failed to toggle task:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    },
  })
}
