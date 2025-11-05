import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper'
import type { MD3Theme } from 'react-native-paper'

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: 'rgb(59, 130, 246)', // Blue 600
    onPrimary: 'rgb(255, 255, 255)',
    primaryContainer: 'rgb(147, 197, 253)', // Blue 300
    onPrimaryContainer: 'rgb(30, 58, 138)',

    secondary: 'rgb(168, 85, 247)', // Purple 600
    onSecondary: 'rgb(255, 255, 255)',
    secondaryContainer: 'rgb(216, 180, 254)', // Purple 300
    onSecondaryContainer: 'rgb(76, 29, 149)',

    tertiary: 'rgb(16, 185, 129)', // Green (for completed)
    onTertiary: 'rgb(255, 255, 255)',
    tertiaryContainer: 'rgb(167, 243, 208)',
    onTertiaryContainer: 'rgb(6, 78, 59)',

    error: 'rgb(239, 68, 68)', // Red (for urgent)
    onError: 'rgb(255, 255, 255)',
    errorContainer: 'rgb(254, 202, 202)',
    onErrorContainer: 'rgb(127, 29, 29)',

    background: 'rgb(250, 250, 250)',
    onBackground: 'rgb(28, 27, 31)',
    surface: 'rgb(255, 255, 255)',
    onSurface: 'rgb(28, 27, 31)',
    surfaceVariant: 'rgb(241, 243, 245)',
    onSurfaceVariant: 'rgb(71, 70, 73)',

    outline: 'rgb(121, 116, 126)',
    outlineVariant: 'rgb(196, 198, 203)',

    shadow: 'rgb(0, 0, 0)',
    scrim: 'rgb(0, 0, 0)',

    inverseSurface: 'rgb(49, 48, 51)',
    inverseOnSurface: 'rgb(244, 239, 244)',
    inversePrimary: 'rgb(147, 197, 253)',

    elevation: {
      level0: 'transparent',
      level1: 'rgb(248, 248, 252)',
      level2: 'rgb(243, 243, 249)',
      level3: 'rgb(238, 238, 246)',
      level4: 'rgb(236, 236, 245)',
      level5: 'rgb(233, 233, 243)',
    },

    surfaceDisabled: 'rgba(28, 27, 31, 0.12)',
    onSurfaceDisabled: 'rgba(28, 27, 31, 0.38)',
    backdrop: 'rgba(49, 47, 55, 0.4)',
  },
  roundness: 3,
}

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: 'rgb(147, 197, 253)', // Blue 300
    onPrimary: 'rgb(30, 64, 175)',
    primaryContainer: 'rgb(30, 64, 175)', // Blue 800
    onPrimaryContainer: 'rgb(191, 219, 254)',

    secondary: 'rgb(216, 180, 254)', // Purple 300
    onSecondary: 'rgb(109, 40, 217)',
    secondaryContainer: 'rgb(109, 40, 217)', // Purple 800
    onSecondaryContainer: 'rgb(233, 213, 255)',

    tertiary: 'rgb(52, 211, 153)', // Green (for completed)
    onTertiary: 'rgb(6, 78, 59)',
    tertiaryContainer: 'rgb(6, 95, 70)',
    onTertiaryContainer: 'rgb(167, 243, 208)',

    error: 'rgb(248, 113, 113)', // Red (for urgent)
    onError: 'rgb(127, 29, 29)',
    errorContainer: 'rgb(153, 27, 27)',
    onErrorContainer: 'rgb(254, 202, 202)',

    background: 'rgb(28, 27, 31)',
    onBackground: 'rgb(230, 225, 229)',
    surface: 'rgb(28, 27, 31)',
    onSurface: 'rgb(230, 225, 229)',
    surfaceVariant: 'rgb(71, 70, 73)',
    onSurfaceVariant: 'rgb(196, 198, 203)',

    outline: 'rgb(146, 143, 153)',
    outlineVariant: 'rgb(71, 70, 73)',

    shadow: 'rgb(0, 0, 0)',
    scrim: 'rgb(0, 0, 0)',

    inverseSurface: 'rgb(230, 225, 229)',
    inverseOnSurface: 'rgb(49, 48, 51)',
    inversePrimary: 'rgb(59, 130, 246)',

    elevation: {
      level0: 'transparent',
      level1: 'rgb(37, 35, 42)',
      level2: 'rgb(42, 40, 48)',
      level3: 'rgb(47, 45, 54)',
      level4: 'rgb(49, 46, 56)',
      level5: 'rgb(52, 49, 60)',
    },

    surfaceDisabled: 'rgba(230, 225, 229, 0.12)',
    onSurfaceDisabled: 'rgba(230, 225, 229, 0.38)',
    backdrop: 'rgba(49, 47, 55, 0.4)',
  },
  roundness: 3,
}

// Priority colors helper
export const getPriorityColor = (priority: string, theme: MD3Theme): string => {
  switch (priority) {
    case 'urgent':
      return theme.colors.error
    case 'high':
      return 'rgb(251, 146, 60)' // Orange
    case 'medium':
      return 'rgb(251, 191, 36)' // Yellow
    case 'low':
      return theme.colors.tertiary
    default:
      return theme.colors.surfaceVariant
  }
}
