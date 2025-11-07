import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import QuickActions from 'react-native-quick-actions';

export function useQuickActions() {
  const router = useRouter();

  useEffect(() => {
    // Only set up quick actions on Android
    if (Platform.OS !== 'android') {
      return;
    }

    // Define quick actions for home screen (long press app icon)
    QuickActions.setShortcutItems([
      {
        type: 'new-task',
        title: 'New Task',
        subtitle: 'Quickly add a task',
        icon: 'add',
        userInfo: {
          url: 'hamflow://quick-add'
        }
      },
      {
        type: 'command',
        title: 'Command',
        subtitle: 'Use AI to add tasks',
        icon: 'compose',
        userInfo: {
          url: 'hamflow://command'
        }
      },
      {
        type: 'agenda',
        title: "Today's Agenda",
        subtitle: 'View your tasks',
        icon: 'home',
        userInfo: {
          url: 'hamflow://agenda'
        }
      },
      {
        type: 'habits',
        title: 'Habits',
        subtitle: 'Track your habits',
        icon: 'bookmark',
        userInfo: {
          url: 'hamflow://habits'
        }
      }
    ]);

    // Handle quick action selection
    const handleQuickAction = (data: any) => {
      if (!data) return;

      switch (data.type) {
        case 'new-task':
          router.push('/modal/quick-add');
          break;
        case 'command':
          router.push('/modal/command');
          break;
        case 'agenda':
          router.push('/' as any);
          break;
        case 'habits':
          router.push('/habits' as any);
          break;
      }
    };

    // Check for initial quick action (when app is launched via quick action)
    QuickActions.popInitialAction()
      .then((data: any) => {
        if (data) {
          handleQuickAction(data);
        }
        return data;
      })
      .catch((error: any) => {
        console.error('Error getting initial quick action:', error);
      });

    // Listen for quick actions while app is running
    let subscription: any;
    try {
      // @ts-ignore - react-native-quick-actions types may be incomplete
      subscription = QuickActions.addListener?.('quickActionShortcut', handleQuickAction);
    } catch {
      console.warn('Quick actions not fully supported');
    }

    return () => {
      subscription?.remove?.();
    };
  }, [router]);
}
