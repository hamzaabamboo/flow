import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { getStoredAccessToken } from '@/store/authStore'
import { useSpaceStore } from '@/store/spaceStore'
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
  const currentSpace = useSpaceStore((state) => state.currentSpace)

  return useMutation({
    mutationFn: async (command: string): Promise<CommandResponse> => {
      const token = await getStoredAccessToken()
      if (!token) throw new Error('Not authenticated')

      if (!currentSpace) throw new Error('No space selected')

      // First, parse the command
      const parseResponse = await fetch(`${API_URL}/api/command`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command, space: currentSpace }),
      })

      if (!parseResponse.ok) {
        const errorText = await parseResponse.text()
        console.error('Parse command failed:', parseResponse.status, errorText)
        throw new Error(`Failed to parse command: ${parseResponse.status} - ${errorText}`)
      }

      const parsedIntent = await parseResponse.json()

      // Then execute the command
      const executeResponse = await fetch(`${API_URL}/api/command/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...parsedIntent, space: currentSpace }),
      })

      if (!executeResponse.ok) {
        const errorText = await executeResponse.text()
        console.error('Execute command failed:', executeResponse.status, errorText)
        throw new Error(`Failed to execute command: ${executeResponse.status} - ${errorText}`)
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
