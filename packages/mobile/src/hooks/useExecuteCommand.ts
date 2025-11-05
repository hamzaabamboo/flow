import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { getStoredToken } from '@/store/authStore'
import { API_URL } from '@/api/client'

interface CommandResponse {
  intent: {
    action: string
    task?: {
      title: string
      description?: string
      dueDate?: string
      priority?: string
      labels?: string[]
      boardId?: string
      columnId?: string
    }
  }
  message: string
}

export const useExecuteCommand = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (command: string): Promise<CommandResponse> => {
      const token = await getStoredToken()
      if (!token) throw new Error('Not authenticated')

      // First, parse the command
      const parseResponse = await fetch(`${API_URL}/api/command`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      })

      if (!parseResponse.ok) {
        throw new Error('Failed to parse command')
      }

      const parsedIntent = await parseResponse.json()

      // Then execute the command
      const executeResponse = await fetch(`${API_URL}/api/command/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ intent: parsedIntent }),
      })

      if (!executeResponse.ok) {
        throw new Error('Failed to execute command')
      }

      return {
        intent: parsedIntent,
        message: 'Command executed successfully',
      }
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (error) => {
      console.error('Failed to execute command:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    },
  })
}
