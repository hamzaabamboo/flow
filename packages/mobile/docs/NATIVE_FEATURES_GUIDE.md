# Native Features Implementation Guide

This document outlines the native features from the TODO list that require native module development or platform-specific implementation.

## Overview

The following features require native code and cannot be implemented purely in JavaScript/TypeScript:

1. **Widget with Command Input** (#9 P3)
2. **App Share Target** (#14 P3)
3. **Agenda Widget** (#16 P3)
4. **App Shortcuts** (#19 P3)

---

## 1. Widget with Command Input (#9 P3)

### Description
Create iOS/Android home screen widget where users can type a command directly, which opens the app with the command pre-filled.

### Technical Requirements

#### iOS (WidgetKit + App Intents)
- **Framework**: WidgetKit with App Intents (iOS 16+)
- **Implementation**:
  ```swift
  // Widget configuration in Swift
  struct CommandInputWidget: Widget {
      var body: some WidgetConfiguration {
          StaticConfiguration(kind: "CommandInputWidget", provider: Provider()) { entry in
              CommandInputWidgetView(entry: entry)
          }
          .configurationDisplayName("Quick Command")
          .description("Type a command to quickly add tasks")
          .supportedFamilies([.systemSmall, .systemMedium])
      }
  }
  ```
- **Deep Link Format**: `hamflow://command?text={encoded_command}`
- **Expo Support**: Requires custom native module or EAS Build with config plugins

#### Android (App Widget)
- **Framework**: Android App Widget
- **Implementation**:
  ```xml
  <!-- Widget layout in res/xml/widget_info.xml -->
  <appwidget-provider
      android:minWidth="250dp"
      android:minHeight="80dp"
      android:updatePeriodMillis="0"
      android:initialLayout="@layout/command_widget"
      android:resizeMode="horizontal|vertical"
      android:widgetCategory="home_screen"/>
  ```
- **Deep Link Handling**: Implemented via Intent filters
- **Expo Support**: Requires custom development build

### Implementation Steps
1. Create EAS Build configuration
2. Add native widget code for iOS (Swift) and Android (Kotlin/Java)
3. Implement deep linking handler in `app/_layout.tsx`
4. Test widget installation and deep link handling
5. Handle text input state and command parsing

### Complexity: **High**
### Estimated Time: 20-30 hours

---

## 2. App Share Target (#14 P3)

### Description
Register app as share target so users can share content from other apps into HamFlow quick add.

### Technical Requirements

#### iOS (Share Extension)
- **Framework**: iOS Share Extension
- **Implementation**:
  ```swift
  // Share Extension view controller
  class ShareViewController: UIViewController {
      override func viewDidLoad() {
          super.viewDidLoad()

          if let item = extensionContext?.inputItems.first as? NSExtensionItem {
              // Extract shared content
              handleSharedContent(item)
          }
      }
  }
  ```
- **Supported Types**:
  - Plain text (`public.plain-text`)
  - URLs (`public.url`)
- **Communication**: Share extension passes data to main app via App Groups

#### Android (Intent Filter)
- **Framework**: Android Intent filters
- **Implementation**:
  ```xml
  <!-- In AndroidManifest.xml -->
  <activity android:name=".ShareActivity">
      <intent-filter>
          <action android:name="android.intent.action.SEND"/>
          <category android:name="android.intent.category.DEFAULT"/>
          <data android:mimeType="text/plain"/>
      </intent-filter>
  </activity>
  ```
- **Supported Types**:
  - Plain text
  - URLs

### Implementation Steps
1. Create EAS Build with share extension targets
2. Implement share extension UI (iOS) and share activity (Android)
3. Extract shared content and parse
4. Open main app with pre-filled quick add modal
5. Handle URL metadata extraction

### Complexity: **Medium-High**
### Estimated Time: 15-20 hours

---

## 3. Agenda Widget (#16 P3)

### Description
Home screen widget showing today's tasks and habits at a glance.

### Technical Requirements

#### iOS (WidgetKit)
- **Widget Variants**:
  - Small: Task count + next task
  - Medium: List of 3-5 upcoming tasks
  - Large: Full agenda with habits
- **Implementation**:
  ```swift
  struct AgendaWidget: Widget {
      var body: some WidgetConfiguration {
          StaticConfiguration(kind: "AgendaWidget", provider: AgendaProvider()) { entry in
              AgendaWidgetView(entry: entry)
          }
          .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
      }
  }
  ```
- **Data Source**: Timeline Provider with API calls to backend
- **Refresh Strategy**: Timeline with 15-minute refresh intervals
- **Interactive Elements**: App Intents for task completion (iOS 17+)

#### Android (App Widget)
- **Widget Variants**: Similar to iOS (1x1, 2x2, 4x2)
- **Implementation**: RemoteViews with ListView for task list
- **Data Source**: WorkManager for periodic updates
- **Refresh Strategy**: AlarmManager + WorkManager for updates

### Features
- Display upcoming tasks sorted by due date
- Show habits for today
- Color-code by priority
- Tap task to open in app
- Tap widget to open agenda view
- Auto-refresh every 15 minutes

### Implementation Steps
1. Create widget UI for all size variants
2. Implement data provider with API calls
3. Set up timeline/refresh strategy
4. Add deep links for task navigation
5. Implement App Intents for interactive elements (iOS 17+)
6. Test across different widget sizes and configurations

### Complexity: **High**
### Estimated Time: 25-35 hours

---

## 4. App Shortcuts (#19 P3)

### Description
Quick actions, Spotlight integration, Siri shortcuts, and keyboard shortcuts.

### Technical Requirements

#### Quick Actions (3D Touch / Long Press)
**iOS:**
```swift
// UIApplicationShortcutItem in Info.plist or dynamically
let shortcut = UIApplicationShortcutItem(
    type: "com.hamflow.newtask",
    localizedTitle: "New Task",
    localizedSubtitle: nil,
    icon: UIApplicationShortcutIcon(systemImageName: "plus"),
    userInfo: nil
)
```

**Android:**
```xml
<!-- In res/xml/shortcuts.xml -->
<shortcuts>
    <shortcut
        android:shortcutId="new_task"
        android:enabled="true"
        android:icon="@drawable/ic_add"
        android:shortcutShortLabel="@string/new_task"
        android:shortcutLongLabel="@string/new_task_long">
        <intent
            android:action="android.intent.action.VIEW"
            android:targetPackage="com.hamflow"
            android:targetClass="com.hamflow.MainActivity"
            android:data="hamflow://quick-add"/>
    </shortcut>
</shortcuts>
```

#### Spotlight Search Integration (iOS)
- **Framework**: Core Spotlight
- **Implementation**:
  ```swift
  import CoreSpotlight

  func indexTasks() {
      let searchableItems = tasks.map { task in
          let attributes = CSSearchableItemAttributeSet(contentType: .text)
          attributes.title = task.title
          attributes.contentDescription = task.description

          return CSSearchableItem(
              uniqueIdentifier: task.id,
              domainIdentifier: "com.hamflow.tasks",
              attributeSet: attributes
          )
      }

      CSSearchableIndex.default().indexSearchableItems(searchableItems)
  }
  ```

#### Siri Shortcuts
- **Framework**: SiriKit + Intents Extension
- **Supported Actions**:
  - "Add task to HamFlow"
  - "Complete today's habits"
  - "Show my agenda"
- **Implementation**: Donate user activities and create custom intents

#### Keyboard Shortcuts (iPad/External Keyboard)
- **Implementation in React Native**:
  ```typescript
  import { useEffect } from 'react'
  import { Platform } from 'react-native'

  // Use react-native-keyboard-manager or similar
  useEffect(() => {
      if (Platform.OS === 'ios') {
          // Register keyboard shortcuts
          KeyboardManager.registerShortcut('N', ['command'], () => {
              // Open new task
          })
      }
  }, [])
  ```

### Implementation Steps
1. Implement Quick Actions (home screen long press)
2. Set up Spotlight indexing (iOS)
3. Create Siri Intents extension
4. Add keyboard shortcut handling
5. Test all shortcuts across devices
6. Add user activity donations for Siri suggestions

### Complexity: **Medium-High**
### Estimated Time: 20-25 hours

---

## Implementation Priority

### Recommended Order:
1. **App Share Target** (#14) - Medium-High complexity, high user value
2. **App Shortcuts** (#19) - Medium-High complexity, good UX improvement
3. **Agenda Widget** (#16) - High complexity, excellent user retention
4. **Command Widget** (#9) - High complexity, niche use case

### Prerequisites

#### For All Features:
1. **EAS Build Setup**
   ```bash
   npm install -g eas-cli
   eas build:configure
   ```

2. **Custom Development Build**
   ```json
   // app.json
   {
     "expo": {
       "plugins": [
         "@config-plugins/ios-share-extension",
         "@config-plugins/ios-widgets"
       ]
     }
   }
   ```

3. **Native Code Structure**
   ```
   packages/mobile/
   ├── ios/
   │   ├── HamFlowWidgets/      # Widget extensions
   │   ├── ShareExtension/       # Share extension
   │   └── Intents/              # Siri intents
   ├── android/
   │   ├── app/src/main/java/
   │   │   └── widgets/          # Android widgets
   │   └── app/src/main/res/
   │       └── xml/              # Widget configs
   ```

#### Tools & Libraries:
- **Expo Config Plugins**: For adding native functionality
- **react-native-quick-actions**: For home screen shortcuts
- **react-native-share-menu**: For share target handling
- **EAS Build**: For custom native builds

---

## Alternative: Web-Based Approach

For some features, consider progressive web app (PWA) alternatives:

- **Share Target**: Web Share Target API (PWA)
- **Shortcuts**: Add to Home Screen with custom icons
- **Widgets**: Not available for PWA, requires native

### Web Share Target Example:
```json
// manifest.json
{
  "share_target": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url"
    }
  }
}
```

---

## Testing Strategy

### iOS
1. Test on physical devices (widgets don't work in simulator fully)
2. Test all widget sizes
3. Test share extension from multiple apps (Safari, Notes, Photos)
4. Test Siri shortcuts with voice commands
5. Test keyboard shortcuts on iPad

### Android
1. Test on multiple Android versions (10+)
2. Test different launchers (Pixel, Samsung, OnePlus)
3. Test widget resizing and configuration
4. Test share target from multiple apps
5. Test app shortcuts (long press on icon)

---

## Conclusion

All P3 native features require:
- Custom development builds (not Expo Go)
- Native code knowledge (Swift/Kotlin)
- Platform-specific configuration
- Extensive testing on physical devices

**Total Estimated Time**: 80-110 hours for all features

**Recommended Approach**: Implement incrementally, starting with App Share Target for immediate user value, then expand to other features based on user feedback and usage metrics.
