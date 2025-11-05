# HamFlow Mobile 📱

Modern React Native mobile app for HamFlow with **Material You (Material Design 3)**.

## 🎯 Core Features

1. **Agenda Viewer** - Day/Week view with tasks and habits
2. **Command Input** - AI-powered voice and text commands
3. **Widgets** - Home screen widgets (iOS + Android) with Material You theming
4. **Wearables** - Apple Watch / Wear OS support (future)

## 🚀 Tech Stack

- **React Native 0.77+** with New Architecture
- **Expo SDK 52+** with Expo Router v4
- **React Native Paper 5.x** - Material Design 3 UI components
- **@tanstack/react-query v5** - Server state management
- **Eden Treaty** - Type-safe API client for ElysiaJS backend
- **Zustand + MMKV** - Fast local state and storage

See [TECH_STACK.md](./TECH_STACK.md) for full technical details.

## 📋 Getting Started

### Prerequisites
```bash
# Install dependencies (from monorepo root)
bun install

# Install Expo CLI globally
bun add -g @expo/cli eas-cli
```

### Development
```bash
cd packages/mobile

# Start development server
bun run dev

# Run on iOS simulator
bun run ios

# Run on Android emulator
bun run android
```

### Environment Variables
Create `.env` file:
```bash
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_WS_URL=ws://localhost:3000
```

## 🏗️ Project Structure

```
packages/mobile/
├── app/                      # Expo Router pages
│   ├── (auth)/              # Authentication screens
│   ├── (tabs)/              # Main tab navigation
│   │   ├── index.tsx        # Agenda screen
│   │   ├── boards.tsx       # Boards screen
│   │   ├── tasks.tsx        # Tasks screen
│   │   └── settings.tsx     # Settings screen
│   ├── modal/               # Modal screens
│   │   └── command.tsx      # AI Command modal
│   └── _layout.tsx          # Root layout
├── src/
│   ├── api/                 # Eden Treaty API client
│   ├── components/          # Shared components
│   ├── features/            # Feature modules
│   ├── hooks/               # Custom hooks
│   ├── services/            # Business logic
│   ├── store/               # Zustand stores
│   └── theme/               # Material You theme
├── ios/                     # iOS native code
│   └── HamFlowWidget/       # iOS Widget Extension
├── android/                 # Android native code
│   └── app/src/main/java/com/hamflow/widget/
├── TECH_STACK.md            # Full technical documentation
├── IMPLEMENTATION_PLAN.md   # Development roadmap
└── README.md                # This file
```

## 📱 Material You Features

- **Dynamic color theming** - Colors extracted from wallpaper (Android 12+)
- **MD3 components** - Cards, FABs, Chips, Dialogs, SegmentedButtons
- **Adaptive styling** - Platform-appropriate design (Android/iOS)
- **Dark mode** - Automatic theme switching
- **Smooth animations** - Reanimated 3.x with 60fps performance

## 🔑 Authentication

Uses existing HamFlow API token system:

```typescript
// Login with API token
const token = await SecureStore.setItemAsync('api_token', token)

// Auto-authenticated requests
const tasks = await api.tasks.index.get()
```

## 🔄 Real-Time Sync

WebSocket integration for live updates:

```typescript
// Automatic query invalidation on WebSocket events
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  queryClient.invalidateQueries({ queryKey: [message.entity] })
}
```

## 🧩 Widgets

### Android Home Screen Widget
- Material You styled widgets
- Sizes: Small, Medium, Large
- Auto-updates every 30 minutes
- Deep links to app

### iOS Home Screen & Lock Screen
- WidgetKit with SwiftUI
- Live Activities for Pomodoro timer
- Shared data via App Groups

## 🎤 Voice Commands

AI-powered natural language processing:

```typescript
// Example commands
"Add task 'Deploy staging' to Engineering board tomorrow at 3pm"
"What's on my agenda today?"
"Complete habit 'Exercise'"
"Start a 25 minute Pomodoro for 'Deep work'"
```

## 🧪 Testing

```bash
# Run unit tests
bun test

# Run E2E tests with Maestro
maestro test .maestro/

# Type check
bun run type-check

# Lint
bun run lint
```

## 📦 Building & Deployment

### Development Builds
```bash
# Build for development
eas build --profile development --platform all

# Install on device
eas build:run --profile development
```

### Production Builds
```bash
# Build for production
eas build --profile production --platform ios
eas build --profile production --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

### OTA Updates
```bash
# Push JS/asset updates (no app store review needed)
eas update --branch production --message "Bug fixes"
```

## 🗺️ Roadmap

### Phase 1: MVP (Weeks 1-4) ✅
- [x] Project setup with Expo + React Native Paper
- [x] Authentication with API tokens
- [x] Agenda viewer (Day/Week)
- [x] Command input (Voice + Text)
- [x] Task CRUD operations
- [x] Real-time WebSocket sync

### Phase 2: Widgets (Weeks 5-6) 🚧
- [ ] Android Home Screen widget
- [ ] iOS Home Screen widget
- [ ] iOS Lock Screen widget
- [ ] Live Activities (Pomodoro)

### Phase 3: Wearables (Weeks 7-8) ⏳
- [ ] Apple Watch app
- [ ] Wear OS app
- [ ] Watch complications

### Phase 4: Polish (Week 9) ⏳
- [ ] E2E tests
- [ ] Performance optimization
- [ ] App Store assets
- [ ] Beta testing

## 📚 Documentation

- **[TECH_STACK.md](./TECH_STACK.md)** - Complete technical stack and architecture
- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - Detailed development plan with code examples

## 🤝 Contributing

This is part of the HamFlow monorepo. See the main project README for contribution guidelines.

## 📄 License

Same as main HamFlow project.

---

**Status**: Planning Phase
**Target Launch**: Q1 2026
**Minimum iOS**: 15.0
**Minimum Android**: 8.0 (API 26)
