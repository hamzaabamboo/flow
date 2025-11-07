import { useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Button, Text, Surface, useTheme, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as AuthSession from 'expo-auth-session';
import { useAuthStore } from '@/store/authStore';
import { performOIDCLogin, fetchUserInfo } from '@/auth/hamauth';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const setTokens = useAuthStore((state) => state.setTokens);
  const theme = useTheme();

  // Create redirect URI using expo-auth-session
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'hamflow',
    path: '(auth)/callback'
  });

  const handleOIDCLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // Perform OIDC authentication flow
      const tokens = await performOIDCLogin(redirectUri);

      if (!tokens) {
        setError('Authentication failed. Please try again.');
        setLoading(false);
        return;
      }

      // Fetch user information
      const userInfo = await fetchUserInfo(tokens.accessToken);

      if (!userInfo) {
        setError('Failed to fetch user information.');
        setLoading(false);
        return;
      }

      // Store tokens and user info
      console.log('[Login] Storing tokens and user info...');
      await setTokens(tokens, {
        email: userInfo.email,
        name: userInfo.name || userInfo.preferred_username
      });

      console.log('[Login] Tokens stored, navigating to tabs...');
      // Navigate to main app
      router.replace('/(tabs)');
    } catch (err) {
      setError('An error occurred during login. Please try again.');
      console.error('OIDC login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text variant="displaySmall" style={[styles.title, { color: theme.colors.primary }]}>
          Welcome to HamFlow
        </Text>
        <Text
          variant="bodyLarge"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          Sign in with HamAuth to continue
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text variant="bodyMedium" style={[styles.error, { color: theme.colors.error }]}>
              {error}
            </Text>
          </View>
        )}

        <Button
          mode="contained"
          onPress={handleOIDCLogin}
          disabled={loading}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          {loading ? <ActivityIndicator color={theme.colors.onPrimary} /> : 'Sign in with HamAuth'}
        </Button>

        <Text variant="bodySmall" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
          You'll be redirected to HamAuth to authenticate
        </Text>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center'
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24
  },
  logo: {
    width: 120,
    height: 120
  },
  title: {
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    marginBottom: 32,
    textAlign: 'center'
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16
  },
  error: {
    textAlign: 'center'
  },
  button: {
    marginTop: 8
  },
  buttonContent: {
    paddingVertical: 8
  },
  hint: {
    marginTop: 16,
    textAlign: 'center'
  }
});
