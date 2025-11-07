# App Icon Creation Guide

Complete guide for creating professional, transparent app icons for HamFlow mobile app.

## Current Issue

The current app icon at `assets/icon.png` is copied from `public/maskable-icon-512x512.png` which:
- Has a solid background instead of transparency
- Doesn't look polished on modern launchers
- Doesn't adapt well to different themes (light/dark)
- Lacks proper adaptive icon layers for Android

## Requirements

### Design Principles
1. **Transparency**: Icon should work on both light and dark backgrounds
2. **Simplicity**: Clear and recognizable at all sizes
3. **Consistency**: Match the HamFlow brand identity
4. **Scalability**: Look sharp from 20x20 to 1024x1024

### Technical Specifications

#### iOS Requirements
- **App Store**: 1024x1024px PNG (no transparency for App Store)
- **App Icon**: Multiple sizes with transparency:
  - 20x20 (@1x, @2x, @3x)
  - 29x29 (@1x, @2x, @3x)
  - 40x40 (@1x, @2x, @3x)
  - 60x60 (@2x, @3x)
  - 76x76 (@1x, @2x)
  - 83.5x83.5 (@2x) - iPad Pro
  - 1024x1024 (App Store)

#### Android Requirements
- **Adaptive Icon**:
  - Foreground layer: 108x108dp (432x432px)
  - Background layer: 108x108dp (432x432px)
  - Safe zone: 66x66dp (264x264px) - critical content must be within this
- **Densities**:
  - mdpi: 48x48px
  - hdpi: 72x72px
  - xhdpi: 96x96px
  - xxhdpi: 144x144px
  - xxxhdpi: 192x192px
- **Play Store**: 512x512px PNG

---

## Design Process

### Step 1: Design the Icon

#### Tools
- **Figma** (recommended): [figma.com](https://figma.com)
- **Sketch**: Mac-only design tool
- **Adobe Illustrator**: Professional vector graphics
- **Inkscape**: Free vector graphics editor

#### Design Guidelines

1. **Start with 1024x1024px canvas**
2. **Use vector shapes** for scalability
3. **Safe zone**: Keep important elements within 80% of canvas
4. **Transparency**: Use transparent background
5. **Colors**: Use HamFlow brand colors
   - Primary: `#8B5CF6` (purple)
   - Secondary: `#06B6D4` (cyan)
   - Accent: `#F59E0B` (amber)

#### Design Concepts

**Option 1: Abstract Flow Symbol**
```
┌─────────────┐
│             │
│    ╱╲ ╱╲    │  Three overlapping waves
│   ╱  ╲  ╲   │  representing workflow/tasks
│  ╱    ╲  ╲  │  in purple gradient
│             │
└─────────────┘
```

**Option 2: Checkmark + H**
```
┌─────────────┐
│             │
│  H ✓        │  Stylized H with checkmark
│  │ ╱        │  representing task completion
│  │╱         │  in purple/cyan gradient
│             │
└─────────────┘
```

**Option 3: Minimal Square + Check**
```
┌─────────────┐
│             │
│   ┌───┐     │  Rounded square with
│   │ ✓ │     │  checkmark inside
│   └───┘     │  gradient background
│             │
└─────────────┘
```

### Step 2: Export for iOS

#### Using Figma
1. Design at 1024x1024px
2. Export as PNG with transparency
3. Use [appicon.co](https://appicon.co) to generate all sizes
4. Or export manually:
   - File → Export
   - Select PNG
   - Export at: 1x, 2x, 3x for each required size

#### Manual Export Sizes
```
icon-20.png       (20x20)
icon-20@2x.png    (40x40)
icon-20@3x.png    (60x60)
icon-29.png       (29x29)
icon-29@2x.png    (58x58)
icon-29@3x.png    (87x87)
icon-40.png       (40x40)
icon-40@2x.png    (80x80)
icon-40@3x.png    (120x120)
icon-60@2x.png    (120x120)
icon-60@3x.png    (180x180)
icon-76.png       (76x76)
icon-76@2x.png    (152x152)
icon-83.5@2x.png  (167x167)
icon-1024.png     (1024x1024)
```

### Step 3: Create Android Adaptive Icon

#### What is Adaptive Icon?
Android Adaptive Icons have two layers:
- **Foreground**: The main icon content (with transparency)
- **Background**: Solid color or gradient (no transparency)

The system applies a mask to create different shapes:
- Circle (Pixel)
- Squircle (Samsung)
- Rounded Square (OnePlus)
- Teardrop (some devices)

#### Layer Design

**Foreground Layer (foreground.png)**
- Size: 432x432px
- Format: PNG with transparency
- Content: Main icon elements
- Safe zone: Center 264x264px (critical content)
- Padding: Leave 84px on all sides for masking

**Background Layer (background.png)**
- Size: 432x432px
- Format: PNG (no transparency needed)
- Content: Solid color or gradient
- Recommendation: Use `#8B5CF6` (HamFlow purple)

#### Export Steps
1. **Foreground**: Export icon elements with padding (432x432)
2. **Background**: Export solid color or gradient (432x432)
3. Place in Android resource directories:
   ```
   android/app/src/main/res/
   ├── mipmap-mdpi/
   │   ├── ic_launcher_foreground.png
   │   └── ic_launcher_background.png
   ├── mipmap-hdpi/
   │   ├── ic_launcher_foreground.png
   │   └── ic_launcher_background.png
   ├── mipmap-xhdpi/
   │   ├── ic_launcher_foreground.png
   │   └── ic_launcher_background.png
   ├── mipmap-xxhdpi/
   │   ├── ic_launcher_foreground.png
   │   └── ic_launcher_background.png
   └── mipmap-xxxhdpi/
       ├── ic_launcher_foreground.png
       └── ic_launcher_background.png
   ```

### Step 4: Configure in Expo

#### Update app.json

```json
{
  "expo": {
    "name": "HamFlow",
    "slug": "hamflow",
    "version": "1.0.0",
    "icon": "./assets/icon.png",
    "ios": {
      "icon": "./assets/icon.png",
      "supportsTablet": true
    },
    "android": {
      "icon": "./assets/icon.png",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#8B5CF6"
      }
    }
  }
}
```

#### Asset Files Needed

Place these files in `packages/mobile/assets/`:

```
assets/
├── icon.png              (1024x1024 - transparent PNG)
├── adaptive-icon.png     (1024x1024 - foreground only with padding)
└── splash.png            (optional: splash screen image)
```

**icon.png**: Standard icon with transparency
**adaptive-icon.png**: Foreground layer only, with safe zone padding

---

## Tools & Resources

### Automatic Icon Generators
1. **[appicon.co](https://appicon.co)** - FREE
   - Upload 1024x1024 PNG
   - Generates all iOS and Android sizes
   - Download as .zip

2. **[makeappicon.com](https://makeappicon.com)** - FREE
   - Upload 1536x1536 PNG
   - Generates iOS, Android, and web icons

3. **[icon.kitchen](https://icon.kitchen)** - FREE
   - Android adaptive icon preview
   - Live preview of different masks
   - Export all densities

4. **Expo Asset Tooling**
   ```bash
   npx expo-optimize
   ```
   - Optimizes images in assets folder
   - Compresses PNGs without quality loss

### Design Resources
- **Icon inspiration**: [dribbble.com/tags/app-icon](https://dribbble.com/tags/app-icon)
- **Adaptive icon testing**: [icon.kitchen](https://icon.kitchen)
- **iOS icon guidelines**: [Apple HIG - App Icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- **Android icon guidelines**: [Material Design - Product Icons](https://m3.material.io/styles/icons/designing-icons)

---

## Testing Checklist

### iOS Testing
- [ ] Install on physical iPhone (simulator doesn't always show correctly)
- [ ] Test on light mode home screen
- [ ] Test on dark mode home screen
- [ ] Test on App Library (blurred backgrounds)
- [ ] Test in App Switcher
- [ ] Test in Spotlight search
- [ ] Test in Settings app
- [ ] Verify no white outline or background

### Android Testing
- [ ] Install on physical Android device
- [ ] Test on Pixel launcher (circle mask)
- [ ] Test on Samsung launcher (squircle mask)
- [ ] Test on OnePlus launcher (rounded square)
- [ ] Test light theme
- [ ] Test dark theme
- [ ] Test in app drawer
- [ ] Test in recent apps
- [ ] Verify safe zone content is visible on all shapes

### Cross-Platform Testing
- [ ] Icon is recognizable at 29x29 (smallest iOS size)
- [ ] Icon is recognizable at 48x48 (smallest Android size)
- [ ] No important content is cut off by Android masks
- [ ] Icon looks good on white background
- [ ] Icon looks good on black background
- [ ] Icon matches brand identity
- [ ] Icon is unique and not generic

---

## Implementation Steps

### Quick Start (Using Generator)

1. **Design icon at 1024x1024px** with transparent background
2. **Go to [appicon.co](https://appicon.co)**
3. **Upload your icon**
4. **Download generated assets**
5. **For iOS**: Use generated icons as-is
6. **For Android**:
   - Create foreground layer (icon with padding)
   - Use solid color background or create gradient
7. **Update app.json** with new icon paths
8. **Test on devices**

### Manual Process

1. **Design** icon in Figma/Sketch/Illustrator
2. **Export** 1024x1024px PNG with transparency → `icon.png`
3. **Export** 1024x1024px foreground only (with padding) → `adaptive-icon.png`
4. **Choose** background color → `#8B5CF6` (purple)
5. **Place** files in `assets/` folder
6. **Update** `app.json` configuration
7. **Build** with EAS Build or Expo
   ```bash
   eas build --platform ios
   eas build --platform android
   ```
8. **Test** on physical devices

---

## Example: HamFlow Icon Design

### Concept: "Flow Check"
A stylized checkmark that flows upward, representing completed tasks and productivity flow.

### Design Specifications
- **Style**: Minimal, modern, geometric
- **Colors**: Purple (`#8B5CF6`) to Cyan (`#06B6D4`) gradient
- **Shape**: Flowing checkmark with rounded ends
- **Background**: Transparent
- **Safe zone compliance**: ✓

### Figma Template
```
Canvas: 1024x1024px
Background: Transparent

Checkmark path:
- Start: (300, 500)
- Bend: (450, 650)
- End: (750, 350)
- Stroke width: 120px
- Stroke cap: Round
- Gradient: 135° angle
  - Purple #8B5CF6 (0%)
  - Cyan #06B6D4 (100%)
```

### Adaptive Icon Variant
```
Canvas: 1024x1024px
Safe zone: Circle, radius 264px from center (512, 512)

Foreground (adaptive-icon.png):
- Same checkmark
- Scaled to fit within safe zone
- Extra padding: 120px on all sides

Background:
- Solid color: #8B5CF6
- Or gradient: #8B5CF6 to #7C3AED (darker purple)
```

---

## Troubleshooting

### Icon has white background on iOS
- **Cause**: PNG has opaque white pixels instead of transparency
- **Fix**: Re-export with transparency enabled in design tool

### Icon is cut off on Android
- **Cause**: Important content outside safe zone (264x264dp)
- **Fix**: Scale down icon elements to fit within center circle

### Icon looks blurry
- **Cause**: Using JPG instead of PNG, or low-resolution source
- **Fix**: Use PNG format and start with 1024x1024px or higher

### Icon doesn't match Android shape
- **Cause**: Expecting specific mask shape
- **Fix**: Design for circle (most restrictive), will work for all shapes

### Icon not updating after change
- **Cause**: Device cache or development build cache
- **Fix**: Uninstall app completely and reinstall, or clear build cache

---

## Next Steps

1. **Create or commission icon design**
   - Use this guide as reference
   - Hire designer on [Fiverr](https://fiverr.com) or [99designs](https://99designs.com)
   - Or design yourself in Figma

2. **Generate all required sizes**
   - Use [appicon.co](https://appicon.co) for batch generation
   - Or export manually using this guide

3. **Place assets in project**
   ```
   packages/mobile/assets/
   ├── icon.png
   ├── adaptive-icon.png
   └── splash.png (optional)
   ```

4. **Update configuration**
   - Modify `app.json`
   - Commit changes to git

5. **Build and test**
   ```bash
   eas build --platform all
   ```

6. **Test on physical devices**
   - iOS: Light mode, dark mode, App Library
   - Android: Multiple launchers and themes

---

## Resources

- [Expo Icon Documentation](https://docs.expo.dev/develop/user-interface/app-icons/)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Android Adaptive Icons](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)
- [Material Design Icons](https://m3.material.io/styles/icons)

---

## Completion Checklist

- [ ] Icon designed at 1024x1024px with transparency
- [ ] iOS icon generated (1024x1024)
- [ ] Android adaptive icon created (foreground + background)
- [ ] Assets placed in `assets/` folder
- [ ] `app.json` updated with icon paths
- [ ] Tested on iOS (light + dark mode)
- [ ] Tested on Android (multiple launchers)
- [ ] Icon looks good at smallest size (29x29)
- [ ] No content cut off by Android masks
- [ ] Committed to version control
