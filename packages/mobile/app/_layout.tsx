import { useEffect, useMemo } from 'react'
import { Stack } from 'expo-router'
import { PaperProvider } from 'react-native-paper'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useColorScheme } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { getThemeForSpace } from '@/theme'
import { useAuthStore } from '@/store/authStore'
import { useSpaceStore } from '@/store/spaceStore'

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
})

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const loadTokens = useAuthStore((state) => state.loadTokens)
  const loadSpace = useSpaceStore((state) => state.loadSpace)
  const currentSpace = useSpaceStore((state) => state.currentSpace)

  // Load stored data on mount
  useEffect(() => {
    loadTokens()
    loadSpace()
  }, [loadTokens, loadSpace])

  // Dynamic theme based on current space
  const theme = useMemo(
    () => getThemeForSpace(currentSpace, colorScheme === 'dark'),
    [currentSpace, colorScheme]
  )

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={theme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="modal/command"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="modal/task/[id]"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
          </Stack>
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
