import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

// Park UI color palettes - matching web app exactly
const colors = {
  // Blue palette (Work space)
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554'
  },
  // Purple palette (Personal space)
  purple: {
    50: '#fdf4ff',
    100: '#fae8ff',
    200: '#f5d0fe',
    300: '#f0abfc',
    400: '#e879f9',
    500: '#d946ef',
    600: '#c026d3',
    700: '#a21caf',
    800: '#86198f',
    900: '#701a75',
    950: '#4a044e'
  },
  // Yellow palette (Medium priority)
  yellow: {
    50: '#fefce8',
    100: '#fef9c3',
    200: '#fef08a',
    300: '#fde047',
    400: '#facc15',
    500: '#eab308',
    600: '#ca8a04',
    700: '#a16207',
    800: '#854d0e',
    900: '#713f12',
    950: '#422006'
  },
  // Orange palette (High priority)
  orange: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
    950: '#431407'
  },
  // Red palette (Urgent priority)
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a'
  },
  // Green palette (Completed)
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16'
  },
  // Zinc palette (Neutral)
  zinc: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
    950: '#09090b'
  }
};

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    // Blue as primary (Work space color)
    primary: colors.blue[600],
    onPrimary: 'rgb(255, 255, 255)',
    primaryContainer: colors.blue[100],
    onPrimaryContainer: colors.blue[900],

    // Purple as secondary (Personal space color)
    secondary: colors.purple[600],
    onSecondary: 'rgb(255, 255, 255)',
    secondaryContainer: colors.purple[100],
    onSecondaryContainer: colors.purple[900],

    // Green for completed/success
    tertiary: colors.green[600],
    onTertiary: 'rgb(255, 255, 255)',
    tertiaryContainer: colors.green[100],
    onTertiaryContainer: colors.green[900],

    // Red for errors/urgent
    error: colors.red[600],
    onError: 'rgb(255, 255, 255)',
    errorContainer: colors.red[100],
    onErrorContainer: colors.red[900],

    // Light backgrounds
    background: colors.zinc[50],
    onBackground: colors.zinc[900],
    surface: 'rgb(255, 255, 255)',
    onSurface: colors.zinc[900],
    surfaceVariant: colors.zinc[100],
    onSurfaceVariant: colors.zinc[600],

    outline: colors.zinc[300],
    outlineVariant: colors.zinc[200],

    shadow: 'rgb(0, 0, 0)',
    scrim: 'rgb(0, 0, 0)',

    inverseSurface: colors.zinc[900],
    inverseOnSurface: colors.zinc[50],
    inversePrimary: colors.blue[400],

    elevation: {
      level0: 'transparent',
      level1: 'rgb(255, 255, 255)',
      level2: colors.zinc[50],
      level3: colors.zinc[100],
      level4: colors.zinc[100],
      level5: colors.zinc[200]
    },

    surfaceDisabled: `rgba(${parseInt(colors.zinc[900].slice(1, 3), 16)}, ${parseInt(colors.zinc[900].slice(3, 5), 16)}, ${parseInt(colors.zinc[900].slice(5, 7), 16)}, 0.12)`,
    onSurfaceDisabled: `rgba(${parseInt(colors.zinc[900].slice(1, 3), 16)}, ${parseInt(colors.zinc[900].slice(3, 5), 16)}, ${parseInt(colors.zinc[900].slice(5, 7), 16)}, 0.38)`,
    backdrop: 'rgba(0, 0, 0, 0.4)'
  },
  roundness: 12 // Material You style - matching web's 'lg' radius
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    // Blue as primary (Work space color) - brighter for dark mode
    primary: colors.blue[400],
    onPrimary: colors.blue[950],
    primaryContainer: colors.blue[800],
    onPrimaryContainer: colors.blue[200],

    // Purple as secondary (Personal space color) - vibrant
    secondary: colors.purple[400],
    onSecondary: colors.purple[950],
    secondaryContainer: colors.purple[800],
    onSecondaryContainer: colors.purple[200],

    // Green for completed/success
    tertiary: colors.green[400],
    onTertiary: colors.green[950],
    tertiaryContainer: colors.green[800],
    onTertiaryContainer: colors.green[200],

    // Red for errors/urgent
    error: colors.red[400],
    onError: colors.red[950],
    errorContainer: colors.red[900],
    onErrorContainer: colors.red[200],

    // Deep dark backgrounds - matching web app
    background: colors.zinc[950], // Almost pure black
    onBackground: colors.zinc[50],
    surface: colors.zinc[900], // Card/surface color
    onSurface: colors.zinc[50],
    surfaceVariant: colors.zinc[800],
    onSurfaceVariant: colors.zinc[400],

    outline: colors.zinc[700],
    outlineVariant: colors.zinc[800],

    shadow: 'rgb(0, 0, 0)',
    scrim: 'rgb(0, 0, 0)',

    inverseSurface: colors.zinc[50],
    inverseOnSurface: colors.zinc[900],
    inversePrimary: colors.blue[600],

    elevation: {
      level0: 'transparent',
      level1: colors.zinc[900],
      level2: colors.zinc[800],
      level3: colors.zinc[800],
      level4: colors.zinc[800],
      level5: colors.zinc[700]
    },

    surfaceDisabled: 'rgba(250, 250, 250, 0.12)',
    onSurfaceDisabled: 'rgba(250, 250, 250, 0.38)',
    backdrop: 'rgba(0, 0, 0, 0.7)'
  },
  roundness: 12 // Material You style - matching web's 'lg' radius
};

// Priority colors helper - matching web version EXACTLY
export const getPriorityColor = (priority: string, isDark: boolean = true): string => {
  if (isDark) {
    switch (priority) {
      case 'urgent':
        return colors.red[400]; // Bright red for dark mode
      case 'high':
        return colors.orange[400]; // Bright orange
      case 'medium':
        return colors.yellow[400]; // Bright yellow/lime
      case 'low':
        return colors.zinc[500]; // Neutral gray
      default:
        return colors.zinc[600];
    }
  } else {
    switch (priority) {
      case 'urgent':
        return colors.red[600];
      case 'high':
        return colors.orange[600];
      case 'medium':
        return colors.yellow[600];
      case 'low':
        return colors.zinc[500];
      default:
        return colors.zinc[400];
    }
  }
};

// Space colors helper - matching web version
export const getSpaceColor = (space: string, isDark: boolean = true): string => {
  if (isDark) {
    switch (space) {
      case 'work':
        return colors.blue[400];
      case 'personal':
        return colors.purple[400];
      default:
        return colors.zinc[400];
    }
  } else {
    switch (space) {
      case 'work':
        return colors.blue[600];
      case 'personal':
        return colors.purple[600];
      default:
        return colors.zinc[600];
    }
  }
};

// Export colors for use in components
export { colors };

// Create a dynamic theme based on the current space
export const getThemeForSpace = (space: 'work' | 'personal', isDark: boolean = true): MD3Theme => {
  const baseTheme = isDark ? darkTheme : lightTheme;

  if (space === 'personal') {
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: isDark ? colors.purple[400] : colors.purple[600],
        onPrimary: isDark ? colors.purple[900] : 'rgb(255, 255, 255)',
        primaryContainer: isDark ? colors.purple[800] : colors.purple[100],
        onPrimaryContainer: isDark ? colors.purple[200] : colors.purple[900],
        inversePrimary: isDark ? colors.purple[600] : colors.purple[400]
      }
    };
  }

  // Work space (default - blue)
  return baseTheme;
};
