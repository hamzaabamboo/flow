import { useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

// @ts-ignore - expo-intent-launcher types may be incomplete
import * as IntentLauncher from 'expo-intent-launcher';

interface QuickAddParams {
  text?: string;
  title?: string;
  url?: string;
}

interface CommandParams {
  text?: string;
}

export function useDeepLinking() {
  const router = useRouter();

  const handleDeepLink = useCallback(
    (url: string) => {
      const { hostname, path, queryParams } = Linking.parse(url);

      // hamflow://quick-add?text=...&title=...&url=...
      if (hostname === 'quick-add' || path === 'quick-add') {
        const params = queryParams as QuickAddParams;

        // Navigate to quick add modal with pre-filled content
        router.push({
          pathname: '/modal/quick-add',
          params: {
            sharedText: params.text || '',
            sharedTitle: params.title || '',
            sharedUrl: params.url || ''
          }
        });
      }

      // hamflow://command?text=...
      else if (hostname === 'command' || path === 'command') {
        const params = queryParams as CommandParams;

        // Navigate to command modal with pre-filled text
        router.push({
          pathname: '/modal/command',
          params: {
            commandText: params.text || ''
          }
        });
      }

      // hamflow://agenda or hamflow://
      else if (hostname === 'agenda' || path === 'agenda' || !hostname) {
        router.push('/' as any);
      }

      // hamflow://tasks
      else if (hostname === 'tasks' || path === 'tasks') {
        router.push('/tasks' as any);
      }

      // hamflow://boards
      else if (hostname === 'boards' || path === 'boards') {
        router.push('/boards' as any);
      }

      // hamflow://habits
      else if (hostname === 'habits' || path === 'habits') {
        router.push('/habits' as any);
      }
    },
    [router]
  );

  useEffect(() => {
    // Handle Android share intent
    const handleAndroidIntent = async () => {
      if (Platform.OS === 'android') {
        try {
          // @ts-ignore
          const intent = await IntentLauncher.getInitialIntent?.();
          if (intent && intent.action === 'android.intent.action.SEND') {
            const sharedText = intent.data || '';
            const sharedTitle = intent.extra?.['android.intent.extra.SUBJECT'] || '';

            // Extract URL if present
            const urlMatch = sharedText.match(/(https?:\/\/[^\s]+)/);
            const sharedUrl = urlMatch ? urlMatch[0] : '';

            // Navigate to quick add with shared content
            router.push({
              pathname: '/modal/quick-add',
              params: {
                sharedText,
                sharedTitle,
                sharedUrl
              }
            });
          }
        } catch {
          // Intent launcher not available or no intent
        }
      }
    };

    // Handle initial URL when app is opened via deep link
    const handleInitialURL = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        handleDeepLink(url);
      }
    };

    // Handle URL changes when app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    handleAndroidIntent();
    handleInitialURL();

    return () => {
      subscription.remove();
    };
  }, [router, handleDeepLink]);

  return { handleDeepLink };
}
