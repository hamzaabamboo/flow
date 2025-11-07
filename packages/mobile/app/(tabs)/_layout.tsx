import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useTheme, IconButton } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SpaceSwitcher } from '@/components/SpaceSwitcher';

function HeaderActions() {
  const router = useRouter();
  const theme = useTheme();

  const handleCommandPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/modal/command');
  };

  return (
    <View style={styles.headerActions}>
      <IconButton
        icon="lightning-bolt"
        size={24}
        iconColor={theme.colors.primary}
        onPress={handleCommandPress}
        style={styles.commandButton}
      />
      <SpaceSwitcher />
    </View>
  );
}

export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface
        },
        headerStyle: {
          backgroundColor: theme.colors.surface
        },
        headerTintColor: theme.colors.onSurface,
        headerRight: () => <HeaderActions />
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar" size={size} color={color} />
          ),
          tabBarLabel: 'Agenda'
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-donut" size={size} color={color} />
          ),
          tabBarLabel: 'Habits'
        }}
      />
      <Tabs.Screen
        name="boards"
        options={{
          title: 'Boards',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
          tabBarLabel: 'Boards'
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="checkbox-marked-outline" size={size} color={color} />
          ),
          tabBarLabel: 'Tasks'
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
          tabBarLabel: 'Settings'
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4
  },
  commandButton: {
    margin: 0
  }
});
