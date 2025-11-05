import { Redirect } from 'expo-router'
import { useAuthStore } from '@/store/authStore'

export default function Index() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  // Simple redirect based on auth
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />
  }

  return <Redirect href="/(auth)/login" />
}
