# HamFlow Mobile - Build Guide

## 🚀 Automated Builds with GitHub Actions

We have two GitHub Actions workflows for building the Android app:

### 1. Direct APK Build (`build-apk.yml`)
**Best for:** Quick development builds, testing

**Triggers:**
- Automatically on push to `main` or `feat/react-native` when mobile files change
- Manually via GitHub Actions UI

**Process:**
1. Go to GitHub Actions tab
2. Select "Build Android APK" workflow
3. Click "Run workflow"
4. Choose build profile (development, preview, production)
5. Download APK from artifacts after build completes

**Pros:**
- Fast builds (runs directly on GitHub runners)
- No Expo account needed
- APK available immediately as artifact

**Cons:**
- Basic build only (no advanced features)
- No build history in Expo dashboard

### 2. EAS Build (`eas-build.yml`)
**Best for:** Production builds, App Store releases

**Triggers:**
- Manual only (via GitHub Actions UI)

**Setup Required:**
1. Create Expo account at https://expo.dev
2. Get an Expo access token from https://expo.dev/accounts/[account]/settings/access-tokens
3. Add `EXPO_TOKEN` to GitHub repository secrets:
   - Go to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `EXPO_TOKEN`
   - Value: Your Expo token
   - Click "Add secret"

**Process:**
1. Go to GitHub Actions tab
2. Select "EAS Build" workflow
3. Click "Run workflow"
4. Choose:
   - Platform: android, ios, or all
   - Profile: development, preview, or production
5. Build runs on Expo servers
6. Download from https://expo.dev when complete

**Pros:**
- Professional build infrastructure
- Build history and management in Expo dashboard
- Supports both Android and iOS
- Production-ready builds
- Automatic version increment

**Cons:**
- Requires Expo account
- Slower (queued builds)
- Limited free build minutes

## 🔧 Build Profiles

### Development
- **Type:** Debug APK
- **Signing:** Debug keystore
- **Use for:** Local testing, development
- **Features:** Development client included

### Preview
- **Type:** Release APK (Android) / Ad-hoc (iOS)
- **Signing:** Release keystore (Android) / Development certificate (iOS)
- **Use for:** Internal testing, QA
- **Features:** Optimized, but not for store

### Production
- **Type:** App Bundle (Android) / App Store (iOS)
- **Signing:** Release keystore (Android) / Distribution certificate (iOS)
- **Use for:** Play Store / App Store submission
- **Features:** Fully optimized, auto-increment version

## 📱 Local Build

For local development builds:

```bash
cd packages/mobile

# Install dependencies
bun install

# Development build with Expo
bunx expo run:android

# Or use EAS locally
eas build --platform android --profile preview --local
```

## 🔑 Environment Variables

Add these to GitHub Secrets if needed:

- `EXPO_TOKEN` - Required for EAS builds
- `EXPO_PUBLIC_API_URL` - API endpoint (optional, defaults to localhost:3000)
- `EXPO_PUBLIC_WS_URL` - WebSocket endpoint (optional, defaults to ws://localhost:3000)

## 📦 Download Builds

### From GitHub Actions:
1. Go to Actions tab
2. Click on the workflow run
3. Scroll to "Artifacts" section
4. Download the APK

### From Expo:
1. Go to https://expo.dev/accounts/[account]/projects/mobile/builds
2. Find your build
3. Click "Download" button

## 🎯 Quick Start

**For quick testing:**
```bash
# Trigger GitHub Actions build-apk workflow manually
# Download APK from artifacts
# Install on device: adb install app-debug.apk
```

**For production:**
```bash
# Setup Expo token in GitHub Secrets
# Trigger eas-build workflow with production profile
# Download from Expo dashboard
# Submit to Play Store
```

## 🐛 Troubleshooting

**Build fails with "Expo token required"**
- Add `EXPO_TOKEN` to GitHub repository secrets

**APK not installing**
- Enable "Install from unknown sources" on Android
- Check if it's a debug build (development/preview only)

**Build is slow**
- EAS builds are queued, may take 10-30 minutes
- Use direct APK build for faster results

**Want to test locally first?**
```bash
cd packages/mobile
bunx expo run:android --variant debug
```
