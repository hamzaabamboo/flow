import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, Surface, useTheme, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

/**
 * OAuth callback handler
 * This route is triggered when HamAuth redirects back to the app
 * expo-auth-session handles the token exchange automatically
 */
export default function CallbackScreen() {
  const theme = useTheme();
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [timeoutReached, setTimeoutReached] = useState(false);

  useEffect(() => {
    console.log('[Callback] Screen mounted, auth state:', isAuthenticated);

    // Check auth state immediately
    if (isAuthenticated) {
      console.log('[Callback] Already authenticated, redirecting to tabs');
      router.replace('/(tabs)');
      return;
    }

    // Give expo-auth-session time to complete (up to 5 seconds)
    const checkInterval = setInterval(() => {
      const currentAuthState = useAuthStore.getState().isAuthenticated;
      console.log('[Callback] Checking auth state:', currentAuthState);

      if (currentAuthState) {
        console.log('[Callback] Auth completed, redirecting to tabs');
        clearInterval(checkInterval);
        router.replace('/(tabs)');
      }
    }, 500);

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      const finalAuthState = useAuthStore.getState().isAuthenticated;

      if (!finalAuthState) {
        console.log('[Callback] Timeout reached, auth not completed');
        setTimeoutReached(true);
      }
    }, 5000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, [router, isAuthenticated]);

  const handleRetry = () => {
    console.log('[Callback] Retrying login...');
    router.replace('/(auth)/login');
  };

  if (timeoutReached) {
    return (
      <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.content}>
          <Text
            variant="titleLarge"
            style={[styles.text, { color: theme.colors.error, marginBottom: 16 }]}
          >
            Authentication Timeout
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.text, { color: theme.colors.onSurface, marginBottom: 24 }]}
          >
            The authentication process took too long. Please try again.
          </Text>
          <Button mode="contained" onPress={handleRetry}>
            Return to Login
          </Button>
        </View>
      </Surface>
    );
  }

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyLarge" style={[styles.text, { color: theme.colors.onSurface }]}>
          Completing authentication...
        </Text>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  content: {
    alignItems: 'center',
    gap: 16
  },
  text: {
    marginTop: 16
  }
});
