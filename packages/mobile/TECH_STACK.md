# HamFlow Mobile - Tech Stack & Architecture

## 🎯 Overview

Modern React Native mobile app for HamFlow with **Material You (Material Design 3)** using cutting-edge 2025 technologies.

## 🚀 Core Technology Stack

### Framework & Runtime
- **React Native 0.77+** - Latest with New Architecture (Fabric + TurboModules) enabled
- **Expo SDK 52+** - Managed workflow with prebuild for native extensions
- **Expo Router v4** - File-based routing (same pattern as Next.js/Vike)
- **TypeScript 5.9+** - Full type safety across app and API

### UI & Styling (Material You)
- **React Native Paper 5.x** - Material Design 3 (Material You) components
  - Dynamic color theming (Material You color extraction)
  - MD3 components (Cards, FAB, Chips, Dialogs, etc.)
  - Adaptive platform styling (Android/iOS)
  - Built-in dark mode support
- **React Native Reanimated 3.x** - 60fps animations on UI thread
- **React Native Gesture Handler 2.x** - Native gesture interactions
- **react-native-safe-area-context** - Safe area handling

### State Management
- **@tanstack/react-query v5** - Server state (same as web version)
- **Zustand** - Lightweight local state management
- **MMKV** - Fast, encrypted local storage (via react-native-mmkv)

### Backend Integration
- **Eden Treaty** - Type-safe ElysiaJS client (same type safety as web)
- **WebSocket** - Real-time sync via native WebSocket API
- **Bearer Token Auth** - Use existing API token system

### Native Features

#### Core Features
- **expo-notifications** - Push notifications
- **expo-calendar** - Calendar access and sync
- **expo-speech-recognition** - Voice command input
- **expo-secure-store** - Encrypted credential storage
- **expo-haptics** - Tactile feedback
- **expo-background-fetch** - Background task sync
- **expo-status-bar** - Status bar theming

#### Widget Support
- **react-native-widget-extension** - iOS Home Screen & Lock Screen widgets
- **react-native-android-widget** - Android Home Screen widgets (Material You styled)
- **expo-live-activities** - iOS 16+ Live Activities

#### Wearables (Optional Phase)
- **react-native-watch-connectivity** - Apple Watch bridge
- **Wear OS SDK** - Android Wear integration with Material Design

### Developer Experience
- **Expo Dev Client** - Custom development builds with native modules
- **EAS Build** - Cloud-based native builds
- **EAS Update** - OTA updates for JS/assets
- **TypeScript** - End-to-end type safety with Eden Treaty

## 🎨 Material You Theme Configuration

### Dynamic Theming
```typescript
// src/theme/index.ts
import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper'
import { useMaterial3Theme } from '@pchmn/expo-material3-theme'

export const useAppTheme = () => {
  const { theme } = useMaterial3Theme()

  const lightTheme = {
    ...MD3LightTheme,
    colors: theme.light,
    // Material You dynamic colors extracted from wallpaper
  }

  const darkTheme = {
    ...MD3DarkTheme,
    colors: theme.dark,
  }

  return { lightTheme, darkTheme }
}
```

### Custom Theme with Brand Colors
```typescript
const hamflowTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: 'rgb(59, 130, 246)', // Blue 600 (from web)
    primaryContainer: 'rgb(147, 197, 253)', // Blue 300
    secondary: 'rgb(168, 85, 247)', // Purple 600
    secondaryContainer: 'rgb(216, 180, 254)', // Purple 300
    tertiary: 'rgb(16, 185, 129)', // Green (for completed)
    error: 'rgb(239, 68, 68)', // Red (for urgent)
  },
  roundness: 3, // Material You corner radius
}
```

## 🏗️ Architecture Patterns

### API Integration Strategy

**Type-Safe API Client:**
```typescript
// packages/mobile/src/api/client.ts
import { edenTreaty } from '@elysiajs/eden'
import type { App } from '../../../server/src/index' // Import server types

export const api = edenTreaty<App>(process.env.EXPO_PUBLIC_API_URL!, {
  fetch: {
    headers: async () => ({
      Authorization: `Bearer ${await getStoredToken()}`
    })
  }
})

// Usage with full type safety
const tasks = await api.tasks.index.get({
  query: { space: 'work' }
})
```

**WebSocket Real-Time Sync:**
```typescript
// Reuse existing WebSocket auth pattern
const wsUrl = `${WS_URL}?token=${encodeURIComponent(token)}`
const ws = new WebSocket(wsUrl)

// Same message types as web version
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  queryClient.invalidateQueries({ queryKey: [message.entity] })
}
```

### Navigation Structure (Expo Router)

```
app/
├── (auth)/
│   ├── login.tsx
│   └── onboarding.tsx
├── (tabs)/
│   ├── _layout.tsx          # Material Bottom Tab Navigation
│   ├── index.tsx            # Agenda (home)
│   ├── boards.tsx           # Boards list
│   ├── tasks.tsx            # All tasks
│   └── settings.tsx         # Settings
├── modal/
│   ├── command.tsx          # AI Command modal
│   └── task-detail.tsx      # Task detail modal
└── _layout.tsx              # Root layout with Paper Provider
```

**Root Layout with Paper:**
```typescript
// app/_layout.tsx
import { PaperProvider } from 'react-native-paper'
import { Stack } from 'expo-router'
import { useAppTheme } from '@/theme'

export default function RootLayout() {
  const { lightTheme, darkTheme } = useAppTheme()
  const colorScheme = useColorScheme()

  return (
    <PaperProvider theme={colorScheme === 'dark' ? darkTheme : lightTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal/command" options={{ presentation: 'modal' }} />
      </Stack>
    </PaperProvider>
  )
}
```

## 📱 Core Features Implementation

### 1. Agenda Viewer (Material Design)

**Component Structure:**
```typescript
// src/features/agenda/AgendaView.tsx
import { Surface, Card, Chip, FAB } from 'react-native-paper'
import { FlashList } from '@shopify/flash-list'

const AgendaView = () => {
  const { data: tasks } = useAgendaTasks()

  return (
    <Surface style={{ flex: 1 }}>
      {/* Segmented Buttons for Day/Week toggle */}
      <SegmentedButtons
        value={view}
        onValueChange={setView}
        buttons={[
          { value: 'day', label: 'Day', icon: 'calendar-today' },
          { value: 'week', label: 'Week', icon: 'calendar-week' }
        ]}
      />

      {/* Task List */}
      <FlashList
        data={tasks}
        renderItem={({ item }) => <TaskCard task={item} />}
        estimatedItemSize={80}
      />

      {/* Material You FAB */}
      <FAB.Group
        open={open}
        icon={open ? 'close' : 'plus'}
        actions={[
          { icon: 'plus', label: 'Quick Add', onPress: () => {} },
          { icon: 'microphone', label: 'Voice Command', onPress: () => {} },
        ]}
        onStateChange={({ open }) => setOpen(open)}
      />
    </Surface>
  )
}
```

**Task Card (Material You):**
```typescript
// src/components/TaskCard.tsx
import { Card, Checkbox, IconButton, Chip } from 'react-native-paper'

const TaskCard = ({ task }) => {
  return (
    <Card mode="elevated" style={{ margin: 8 }}>
      <Card.Content>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Checkbox
            status={task.completed ? 'checked' : 'unchecked'}
            onPress={() => toggleTask(task.id)}
          />
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium">{task.title}</Text>
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
              {task.dueDate && (
                <Chip icon="clock-outline" compact>
                  {formatTime(task.dueDate)}
                </Chip>
              )}
              {task.priority && (
                <Chip
                  icon="flag"
                  compact
                  style={{ backgroundColor: getPriorityColor(task.priority) }}
                >
                  {task.priority}
                </Chip>
              )}
            </View>
          </View>
          <IconButton
            icon="dots-vertical"
            onPress={() => openMenu(task)}
          />
        </View>
      </Card.Content>
    </Card>
  )
}
```

**Swipe Actions (Android Material):**
```typescript
import { Swipeable } from 'react-native-gesture-handler'

const renderRightActions = () => (
  <View style={{ flexDirection: 'row' }}>
    <Button
      mode="contained"
      icon="check"
      onPress={completeTask}
      style={{ backgroundColor: theme.colors.tertiary }}
    >
      Done
    </Button>
    <Button
      mode="contained"
      icon="delete"
      onPress={deleteTask}
      style={{ backgroundColor: theme.colors.error }}
    >
      Delete
    </Button>
  </View>
)

<Swipeable renderRightActions={renderRightActions}>
  <TaskCard task={task} />
</Swipeable>
```

### 2. Command Input (Material Design Modal)

**Voice Command Modal:**
```typescript
// app/modal/command.tsx
import { Modal, Portal, TextInput, Button } from 'react-native-paper'

const CommandModal = () => {
  const [visible, setVisible] = useState(false)
  const [command, setCommand] = useState('')
  const [isListening, setIsListening] = useState(false)

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={() => setVisible(false)}
        contentContainerStyle={{
          backgroundColor: theme.colors.surface,
          padding: 20,
          margin: 20,
          borderRadius: theme.roundness * 4
        }}
      >
        <Text variant="headlineSmall">What would you like to do?</Text>

        <TextInput
          mode="outlined"
          label="Type or speak command"
          value={command}
          onChangeText={setCommand}
          right={
            <TextInput.Icon
              icon={isListening ? 'microphone' : 'microphone-outline'}
              onPress={startVoiceRecognition}
              animated
            />
          }
        />

        {/* Recent commands */}
        <Text variant="labelLarge" style={{ marginTop: 16 }}>
          Recent
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {recentCommands.map(cmd => (
            <Chip key={cmd} onPress={() => setCommand(cmd)}>
              {cmd}
            </Chip>
          ))}
        </View>

        <Button
          mode="contained"
          onPress={executeCommand}
          loading={isProcessing}
          style={{ marginTop: 16 }}
        >
          Execute
        </Button>
      </Modal>
    </Portal>
  )
}
```

### 3. Home Screen Widgets (Material You)

**Android Widget (Material Design 3):**
```kotlin
// android/app/src/main/java/com/hamflow/widget/AgendaWidget.kt
@Composable
fun AgendaWidget(tasks: List<Task>) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.surface)
      .padding(16.dp)
  ) {
    Text(
      text = "Today's Agenda",
      style = MaterialTheme.typography.titleLarge,
      color = MaterialTheme.colorScheme.onSurface
    )

    Spacer(modifier = Modifier.height(8.dp))

    tasks.forEach { task ->
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
          containerColor = MaterialTheme.colorScheme.primaryContainer
        )
      ) {
        Row(modifier = Modifier.padding(12.dp)) {
          Checkbox(
            checked = task.completed,
            onCheckedChange = { /* deep link to app */ }
          )
          Column {
            Text(task.title, style = MaterialTheme.typography.bodyMedium)
            if (task.dueDate != null) {
              Text(
                formatTime(task.dueDate),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }
        }
      }
    }
  }
}
```

**iOS Widget (Material-inspired):**
```swift
// ios/HamFlowWidget/AgendaWidget.swift
struct AgendaWidgetView: View {
  var entry: AgendaEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Today's Agenda")
        .font(.headline)
        .foregroundColor(.primary)

      ForEach(entry.tasks) { task in
        HStack {
          Image(systemName: task.completed ? "checkmark.circle.fill" : "circle")
            .foregroundColor(.blue)

          VStack(alignment: .leading) {
            Text(task.title)
              .font(.body)

            if let dueDate = task.dueDate {
              Text(formatTime(dueDate))
                .font(.caption)
                .foregroundColor(.secondary)
            }
          }
        }
        .padding(8)
        .background(Color.blue.opacity(0.1))
        .cornerRadius(8)
      }
    }
    .padding()
  }
}
```

**Widget Data Sync:**
```typescript
// src/services/widgetSync.ts
import { SharedStorage } from 'react-native-widget-extension'

export const syncWidgetData = async () => {
  const tasks = await fetchTodayTasks()

  // Share with iOS widget
  await SharedStorage.setItem(
    'today_tasks',
    JSON.stringify(tasks)
  )

  // Share with Android widget (via WorkManager)
  if (Platform.OS === 'android') {
    await AndroidWidgetModule.updateWidget({
      tasks: tasks.slice(0, 5) // Limit to 5 tasks
    })
  }
}
```

### 4. Material You Theming Examples

**Bottom Navigation:**
```typescript
// app/(tabs)/_layout.tsx
import { createMaterialBottomTabNavigator } from 'react-native-paper/react-navigation'

const Tab = createMaterialBottomTabNavigator()

export default function TabLayout() {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="index"
        options={{
          tabBarLabel: 'Agenda',
          tabBarIcon: 'calendar',
        }}
      />
      <Tab.Screen
        name="boards"
        options={{
          tabBarLabel: 'Boards',
          tabBarIcon: 'view-dashboard',
        }}
      />
      <Tab.Screen
        name="tasks"
        options={{
          tabBarLabel: 'Tasks',
          tabBarIcon: 'checkbox-marked-outline',
        }}
      />
      <Tab.Screen
        name="settings"
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: 'cog',
        }}
      />
    </Tab.Navigator>
  )
}
```

**Settings Page (Material Design):**
```typescript
// app/(tabs)/settings.tsx
import { List, Switch, Divider, Avatar } from 'react-native-paper'

const SettingsScreen = () => {
  return (
    <ScrollView>
      <List.Section>
        <List.Subheader>Appearance</List.Subheader>
        <List.Item
          title="Dark Mode"
          left={() => <List.Icon icon="theme-light-dark" />}
          right={() => <Switch value={darkMode} onValueChange={setDarkMode} />}
        />
        <List.Item
          title="Material You Colors"
          description="Use colors from wallpaper"
          left={() => <List.Icon icon="palette" />}
          right={() => <Switch value={dynamicColors} onValueChange={setDynamicColors} />}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Notifications</List.Subheader>
        <List.Item
          title="HamBot Integration"
          description="Discord, Slack notifications"
          left={() => <List.Icon icon="robot" />}
          onPress={() => navigation.navigate('hambot-settings')}
        />
      </List.Section>
    </ScrollView>
  )
}
```

## 🔒 Security

### Token Storage
```typescript
import * as SecureStore from 'expo-secure-store'

// Store API token securely
await SecureStore.setItemAsync('api_token', token, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED
})
```

### Biometric Auth
```typescript
import * as LocalAuthentication from 'expo-local-authentication'

const authenticate = async () => {
  const { success } = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock HamFlow',
    fallbackLabel: 'Use passcode'
  })

  if (success) {
    const token = await SecureStore.getItemAsync('api_token')
    return token
  }
}
```

## 📦 Project Structure

```
packages/mobile/
├── app/                      # Expo Router pages
│   ├── (auth)/
│   ├── (tabs)/
│   ├── modal/
│   └── _layout.tsx
├── src/
│   ├── api/                  # Eden Treaty client
│   ├── components/           # Shared components
│   │   ├── TaskCard.tsx
│   │   ├── HabitCard.tsx
│   │   └── Loading.tsx
│   ├── features/             # Feature modules
│   │   ├── agenda/
│   │   ├── boards/
│   │   ├── tasks/
│   │   └── settings/
│   ├── hooks/                # Custom hooks
│   ├── services/             # Business logic
│   │   ├── widgetSync.ts
│   │   ├── websocket.ts
│   │   └── voiceRecognition.ts
│   ├── store/                # Zustand stores
│   └── theme/                # Material You theme
├── ios/                      # iOS native code
│   └── HamFlowWidget/        # Widget extension
├── android/                  # Android native code
│   └── app/src/main/java/com/hamflow/widget/
├── app.json                  # Expo config
├── package.json
└── tsconfig.json
```

## 🚀 Getting Started

### Installation
```bash
cd packages/mobile
bun install

# Install Expo CLI
bun add -g @expo/cli eas-cli

# Prebuild native projects
bunx expo prebuild

# Start development
bun run dev
```

### Build & Deploy
```bash
# Development build
eas build --profile development --platform all

# Production build
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## 🔮 Roadmap

### Phase 1 (MVP) - Core Features
- ✅ Material You theming
- ✅ Agenda viewer (Day/Week)
- ✅ Command input (voice + text)
- ✅ Task CRUD operations
- ✅ Real-time sync
- ✅ Push notifications

### Phase 2 - Widgets
- ✅ Android Home Screen widget
- ✅ iOS Home Screen widget
- ✅ iOS Lock Screen widget
- ✅ Live Activities (Pomodoro)

### Phase 3 - Wearables
- ⏳ Apple Watch app
- ⏳ Wear OS app
- ⏳ Watch complications

### Phase 4 - Advanced
- ⏳ Siri Shortcuts
- ⏳ Share Extension
- ⏳ App Clips
- ⏳ CarPlay support

---

**Last Updated**: 2025-11-05
**Material Design Version**: Material You (MD3)
