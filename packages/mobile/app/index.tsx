import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuthStore } from '@/store/authStore'

export default function Index() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    console.log('[Index] Auth state:', { isAuthenticated })
    // Give a moment for auth to load
    const timer = setTimeout(() => {
      setIsReady(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [isAuthenticated])

  if (!isReady) {
    console.log('[Index] Waiting for auth state...')
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  console.log('[Index] Redirecting...', { isAuthenticated, destination: isAuthenticated ? '/(tabs)' : '/(auth)/login' })

  // Simple redirect based on auth
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />
  }

  return <Redirect href="/(auth)/login" />
}
