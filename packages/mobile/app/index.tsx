import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '@/store/authStore';

export default function Index() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  console.log('[Index] Auth state:', { isAuthenticated, isLoading });

  // Wait for auth to finish loading from SecureStore
  if (isLoading) {
    console.log('[Index] Loading auth state from SecureStore...');
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#09090b'
        }}
      >
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  console.log('[Index] Redirecting...', {
    isAuthenticated,
    destination: isAuthenticated ? '/(tabs)' : '/(auth)/login'
  });

  // Redirect based on auth state
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
