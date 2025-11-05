import { Tabs } from 'expo-router'
import { useTheme } from 'react-native-paper'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { SpaceSwitcher } from '@/components/SpaceSwitcher'

export default function TabLayout() {
  const theme = useTheme()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.onSurface,
        headerRight: () => <SpaceSwitcher />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar" size={size} color={color} />
          ),
          tabBarLabel: 'Agenda',
        }}
      />
      <Tabs.Screen
        name="boards"
        options={{
          title: 'Boards',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
          tabBarLabel: 'Boards',
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="checkbox-marked-outline" size={size} color={color} />
          ),
          tabBarLabel: 'Tasks',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
          tabBarLabel: 'Settings',
        }}
      />
    </Tabs>
  )
}
