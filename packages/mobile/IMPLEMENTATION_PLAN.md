# HamFlow Mobile - Implementation Plan

## 🎯 Project Goal

Build a modern React Native mobile app with **Material You** design that provides core HamFlow functionality on mobile devices.

## 📋 Core Features (MVP)

1. **Agenda Viewer** - Day/Week view with tasks and habits
2. **Command Input** - Voice + text AI commands
3. **Widgets** - Home screen widgets (iOS + Android)
4. **Wearables** - Apple Watch / Wear OS (Future)

## 🏗️ Implementation Phases

### Phase 0: Project Setup (Week 1)

#### Tasks
- [ ] Initialize Expo project with TypeScript
- [ ] Set up React Native Paper with Material You theme
- [ ] Configure Expo Router (file-based routing)
- [ ] Set up Eden Treaty for type-safe API client
- [ ] Configure environment variables (API URL, WS URL)
- [ ] Set up React Query with proper cache configuration
- [ ] Configure Zustand for local state
- [ ] Set up MMKV for fast storage

#### Commands
```bash
# Create new Expo project
cd packages
bunx create-expo-app mobile --template expo-template-blank-typescript

# Install dependencies
cd mobile
bun add react-native-paper @tanstack/react-query zustand react-native-mmkv
bun add expo-router expo-secure-store expo-haptics
bun add @elysiajs/eden
bun add @shopify/flash-list react-native-safe-area-context

# Install dev dependencies
bun add -D @types/react @types/react-native

# Prebuild for native modules
bunx expo prebuild
```

#### File Structure
```
packages/mobile/
├── app/
│   └── _layout.tsx
├── src/
│   ├── api/
│   │   └── client.ts
│   ├── theme/
│   │   └── index.ts
│   └── store/
│       └── authStore.ts
├── app.json
├── package.json
└── tsconfig.json
```

#### Key Files

**app.json**
```json
{
  "expo": {
    "name": "HamFlow",
    "slug": "hamflow",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "hamflow",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#3B82F6"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store"
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    }
  }
}
```

**src/api/client.ts**
```typescript
import { edenTreaty } from '@elysiajs/eden'
import type { App } from '../../../server/src/index'
import { getStoredToken } from '@/store/authStore'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3000'

export const api = edenTreaty<App>(API_URL, {
  fetch: {
    headers: async () => {
      const token = await getStoredToken()
      return {
        Authorization: token ? `Bearer ${token}` : ''
      }
    }
  }
})

export { WS_URL }
```

**src/theme/index.ts**
```typescript
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper'

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: 'rgb(59, 130, 246)', // Blue 600
    primaryContainer: 'rgb(147, 197, 253)', // Blue 300
    secondary: 'rgb(168, 85, 247)', // Purple 600
    secondaryContainer: 'rgb(216, 180, 254)', // Purple 300
    tertiary: 'rgb(16, 185, 129)', // Green
    error: 'rgb(239, 68, 68)', // Red
  },
  roundness: 3,
}

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: 'rgb(147, 197, 253)',
    primaryContainer: 'rgb(30, 64, 175)',
    secondary: 'rgb(216, 180, 254)',
    secondaryContainer: 'rgb(109, 40, 217)',
    tertiary: 'rgb(52, 211, 153)',
    error: 'rgb(248, 113, 113)',
  },
  roundness: 3,
}
```

**app/_layout.tsx**
```typescript
import { PaperProvider } from 'react-native-paper'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useColorScheme } from 'react-native'
import { lightTheme, darkTheme } from '@/theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    }
  }
})

export default function RootLayout() {
  const colorScheme = useColorScheme()

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={colorScheme === 'dark' ? darkTheme : lightTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal/command"
            options={{
              presentation: 'modal',
              title: 'Command'
            }}
          />
        </Stack>
      </PaperProvider>
    </QueryClientProvider>
  )
}
```

---

### Phase 1: Authentication & Core UI (Week 2)

#### Tasks
- [ ] Build login screen with Material Design
- [ ] Implement API token authentication
- [ ] Set up secure token storage (expo-secure-store)
- [ ] Create bottom tab navigation
- [ ] Build basic Agenda screen layout
- [ ] Set up WebSocket connection with auth

#### Files to Create

**app/(auth)/login.tsx**
```typescript
import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { TextInput, Button, Text, Surface } from 'react-native-paper'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'

export default function LoginScreen() {
  const [apiToken, setApiToken] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    setLoading(true)
    try {
      // Verify token with API
      const response = await fetch(`${API_URL}/api/tasks`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      })

      if (response.ok) {
        await SecureStore.setItemAsync('api_token', apiToken)
        router.replace('/(tabs)')
      } else {
        alert('Invalid token')
      }
    } catch (error) {
      alert('Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Surface style={styles.container}>
      <Text variant="displaySmall">Welcome to HamFlow</Text>
      <TextInput
        mode="outlined"
        label="API Token"
        value={apiToken}
        onChangeText={setApiToken}
        secureTextEntry
        style={styles.input}
      />
      <Button
        mode="contained"
        onPress={handleLogin}
        loading={loading}
        style={styles.button}
      >
        Login
      </Button>
    </Surface>
  )
}
```

**app/(tabs)/_layout.tsx**
```typescript
import { Tabs } from 'expo-router'
import { useTheme } from 'react-native-paper'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'

export default function TabLayout() {
  const theme = useTheme()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="boards"
        options={{
          title: 'Boards',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="checkbox-marked-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
```

**src/services/websocket.ts**
```typescript
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { WS_URL } from '@/api/client'
import { getStoredToken } from '@/store/authStore'

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout

    const connect = async () => {
      const token = await getStoredToken()
      if (!token) return

      const ws = new WebSocket(`${WS_URL}/ws?token=${encodeURIComponent(token)}`)

      ws.onopen = () => {
        console.log('WebSocket connected')
      }

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data)

        // Invalidate queries based on entity type
        switch (message.type) {
          case 'task_created':
          case 'task_updated':
          case 'task_deleted':
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
            queryClient.invalidateQueries({ queryKey: ['agenda'] })
            break
          case 'habit_logged':
            queryClient.invalidateQueries({ queryKey: ['habits'] })
            break
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        // Reconnect after 5 seconds
        reconnectTimeout = setTimeout(connect, 5000)
      }

      wsRef.current = ws
    }

    connect()

    return () => {
      clearTimeout(reconnectTimeout)
      wsRef.current?.close()
    }
  }, [queryClient])
}
```

---

### Phase 2: Agenda Viewer (Week 3)

#### Tasks
- [ ] Build task list with FlashList
- [ ] Create TaskCard component with Material Design
- [ ] Implement swipe gestures (complete, delete)
- [ ] Add day/week view toggle (SegmentedButtons)
- [ ] Fetch tasks from API with React Query
- [ ] Implement pull-to-refresh
- [ ] Add FAB for quick actions

#### Files to Create

**app/(tabs)/index.tsx**
```typescript
import { useState } from 'react'
import { View, RefreshControl } from 'react-native'
import { Surface, SegmentedButtons, FAB } from 'react-native-paper'
import { FlashList } from '@shopify/flash-list'
import { useAgendaTasks } from '@/hooks/useAgendaTasks'
import { TaskCard } from '@/components/TaskCard'
import { useRouter } from 'expo-router'

export default function AgendaScreen() {
  const [view, setView] = useState('day')
  const router = useRouter()
  const { data: tasks, isLoading, refetch } = useAgendaTasks(view)

  return (
    <Surface style={{ flex: 1 }}>
      <View style={{ padding: 16 }}>
        <SegmentedButtons
          value={view}
          onValueChange={setView}
          buttons={[
            { value: 'day', label: 'Day', icon: 'calendar-today' },
            { value: 'week', label: 'Week', icon: 'calendar-week' }
          ]}
        />
      </View>

      <FlashList
        data={tasks}
        renderItem={({ item }) => <TaskCard task={item} />}
        estimatedItemSize={80}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      />

      <FAB
        icon="plus"
        style={{ position: 'absolute', right: 16, bottom: 16 }}
        onPress={() => router.push('/modal/command')}
      />
    </Surface>
  )
}
```

**src/components/TaskCard.tsx**
```typescript
import { View, StyleSheet } from 'react-native'
import { Card, Checkbox, Text, Chip, IconButton, useTheme } from 'react-native-paper'
import { Swipeable } from 'react-native-gesture-handler'
import { format } from 'date-fns'
import * as Haptics from 'expo-haptics'

interface TaskCardProps {
  task: Task
}

export const TaskCard = ({ task }: TaskCardProps) => {
  const theme = useTheme()
  const { mutate: toggleTask } = useToggleTask()
  const { mutate: deleteTask } = useDeleteTask()

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    toggleTask(task.id)
  }

  const renderRightActions = () => (
    <View style={styles.swipeActions}>
      <IconButton
        icon="check"
        iconColor="white"
        containerColor={theme.colors.tertiary}
        size={24}
        onPress={handleToggle}
      />
      <IconButton
        icon="delete"
        iconColor="white"
        containerColor={theme.colors.error}
        size={24}
        onPress={() => deleteTask(task.id)}
      />
    </View>
  )

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <Card mode="elevated" style={styles.card}>
        <Card.Content>
          <View style={styles.row}>
            <Checkbox
              status={task.completed ? 'checked' : 'unchecked'}
              onPress={handleToggle}
            />
            <View style={styles.content}>
              <Text variant="titleMedium">{task.title}</Text>
              {task.description && (
                <Text variant="bodySmall" numberOfLines={1}>
                  {task.description}
                </Text>
              )}
              <View style={styles.chips}>
                {task.dueDate && (
                  <Chip icon="clock-outline" compact>
                    {format(new Date(task.dueDate), 'HH:mm')}
                  </Chip>
                )}
                {task.priority && (
                  <Chip
                    icon="flag"
                    compact
                    style={{
                      backgroundColor: getPriorityColor(task.priority, theme)
                    }}
                  >
                    {task.priority}
                  </Chip>
                )}
              </View>
            </View>
            <IconButton icon="dots-vertical" onPress={() => {}} />
          </View>
        </Card.Content>
      </Card>
    </Swipeable>
  )
}

const styles = StyleSheet.create({
  card: { margin: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  content: { flex: 1, marginLeft: 8 },
  chips: { flexDirection: 'row', gap: 4, marginTop: 8 },
  swipeActions: { flexDirection: 'row', alignItems: 'center' }
})
```

**src/hooks/useAgendaTasks.ts**
```typescript
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns'
import { useSpaceStore } from '@/store/spaceStore'

export const useAgendaTasks = (view: 'day' | 'week') => {
  const { currentSpace } = useSpaceStore()
  const today = new Date()

  const startDate = view === 'day' ? startOfDay(today) : startOfWeek(today)
  const endDate = view === 'day' ? endOfDay(today) : endOfWeek(today)

  return useQuery({
    queryKey: ['agenda', view, format(today, 'yyyy-MM-dd'), currentSpace],
    queryFn: async () => {
      const response = await api.calendar.events.get({
        query: {
          start: startDate.getTime(),
          end: endDate.getTime(),
          space: currentSpace
        }
      })

      if (response.error) throw new Error('Failed to fetch tasks')
      return response.data
    }
  })
}
```

---

### Phase 3: Command Input (Week 4)

#### Tasks
- [ ] Create command modal UI
- [ ] Integrate expo-speech-recognition
- [ ] Add voice recording animation
- [ ] Connect to `/api/command` endpoint
- [ ] Show command suggestions
- [ ] Execute parsed commands
- [ ] Handle command errors gracefully

#### Files

**app/modal/command.tsx** - See TECH_STACK.md for full implementation

**src/hooks/useVoiceCommand.ts**
```typescript
import { useState, useEffect } from 'react'
import * as Speech from 'expo-speech-recognition'
import * as Haptics from 'expo-haptics'

export const useVoiceCommand = () => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')

  useEffect(() => {
    const subscription = Speech.onResult((event) => {
      const text = event.results[0]?.transcript
      if (text) {
        setTranscript(text)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    })

    return () => subscription.remove()
  }, [])

  const startListening = async () => {
    const { granted } = await Speech.requestPermissionsAsync()
    if (!granted) {
      alert('Microphone permission required')
      return
    }

    await Speech.start({ lang: 'en-US' })
    setIsListening(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }

  const stopListening = async () => {
    await Speech.stop()
    setIsListening(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  return { isListening, transcript, startListening, stopListening, setTranscript }
}
```

---

### Phase 4: Widgets (Weeks 5-6)

#### Android Widget
- [ ] Set up Jetpack Compose for widgets
- [ ] Create AgendaWidget composable
- [ ] Implement data sharing via SharedPreferences
- [ ] Add deep links to app
- [ ] Style with Material You colors

#### iOS Widget
- [ ] Create Widget Extension target
- [ ] Build SwiftUI widget views
- [ ] Share data via App Groups
- [ ] Add widget configuration
- [ ] Implement timeline provider

---

### Phase 5: Testing & Polish (Week 7)

#### Tasks
- [ ] Write unit tests for hooks
- [ ] E2E tests with Maestro
- [ ] Performance optimization
- [ ] Error boundary implementation
- [ ] Analytics integration
- [ ] Crash reporting (Sentry)

---

## 📦 Package.json Scripts

```json
{
  "scripts": {
    "dev": "expo start",
    "ios": "expo run:ios",
    "android": "expo run:android",
    "prebuild": "expo prebuild",
    "build:ios": "eas build --platform ios",
    "build:android": "eas build --platform android",
    "test": "jest",
    "lint": "eslint .",
    "type-check": "tsc --noEmit"
  }
}
```

---

## 🚀 Launch Checklist

### Pre-Launch
- [ ] App icon and splash screen
- [ ] App Store screenshots
- [ ] Privacy policy
- [ ] Terms of service
- [ ] Beta testing (TestFlight + Google Play Beta)

### Launch
- [ ] Submit to App Store
- [ ] Submit to Google Play
- [ ] Announce on social media
- [ ] Create documentation

---

**Next Steps**: Start with Phase 0 - Project Setup
