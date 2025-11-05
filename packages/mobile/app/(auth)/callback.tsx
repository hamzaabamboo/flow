import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { Text, ActivityIndicator, Surface, useTheme } from 'react-native-paper'
import { useRouter } from 'expo-router'

/**
 * OAuth callback handler
 * This route is triggered when HamAuth redirects back to the app
 * expo-auth-session handles the token exchange automatically
 */
export default function CallbackScreen() {
  const theme = useTheme()
  const router = useRouter()

  useEffect(() => {
    // Give expo-auth-session a moment to complete
    const timer = setTimeout(() => {
      // If we're still here after 2 seconds, redirect to login
      router.replace('/(auth)/login')
    }, 2000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyLarge" style={[styles.text, { color: theme.colors.onSurface }]}>
          Completing authentication...
        </Text>
      </View>
    </Surface>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  text: {
    marginTop: 16,
  },
})
