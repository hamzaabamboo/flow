import { useEffect, useMemo } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getThemeForSpace } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useSpaceStore } from '@/store/spaceStore';
import { useThemeStore } from '@/store/themeStore';
import { useDeepLinking } from '@/hooks/useDeepLinking';
import { useQuickActions } from '@/hooks/useQuickActions';

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2
    }
  }
});

export default function RootLayout() {
  const systemColorScheme = useColorScheme();
  const loadTokens = useAuthStore((state) => state.loadTokens);
  const loadSpace = useSpaceStore((state) => state.loadSpace);
  const currentSpace = useSpaceStore((state) => state.currentSpace);
  const loadThemeMode = useThemeStore((state) => state.loadThemeMode);
  const getEffectiveTheme = useThemeStore((state) => state.getEffectiveTheme);

  // Set up deep linking and quick actions (lazy loaded after auth check)
  useDeepLinking();
  useQuickActions();

  // Load stored data on mount - auth is loaded first, others in parallel
  useEffect(() => {
    // Load auth tokens first as they're critical for startup
    loadTokens();

    // Load other preferences in parallel after a brief delay to not block auth
    const timer = setTimeout(() => {
      Promise.all([loadSpace(), loadThemeMode()]);
    }, 0);

    return () => clearTimeout(timer);
  }, [loadTokens, loadSpace, loadThemeMode]);

  // Determine if we should use dark mode
  const isDarkMode = useMemo(() => {
    const effectiveTheme = getEffectiveTheme(systemColorScheme as 'light' | 'dark' | null);
    return effectiveTheme === 'dark';
  }, [getEffectiveTheme, systemColorScheme]);

  // Dynamic theme based on current space and theme mode
  const theme = useMemo(
    () => getThemeForSpace(currentSpace, isDarkMode),
    [currentSpace, isDarkMode]
  );

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
                headerShown: false
              }}
            />
            <Stack.Screen
              name="modal/quick-add"
              options={{
                presentation: 'modal',
                headerShown: false
              }}
            />
            <Stack.Screen
              name="modal/task/[id]"
              options={{
                presentation: 'modal',
                headerShown: false
              }}
            />
          </Stack>
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
