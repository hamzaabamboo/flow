import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  loadThemeMode: () => Promise<void>;
  getEffectiveTheme: (systemTheme: 'light' | 'dark' | null) => 'light' | 'dark';
}

const THEME_STORAGE_KEY = 'theme_mode';

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: 'auto',

  setThemeMode: async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      set({ themeMode: mode });
      console.log('[ThemeStore] Theme mode set to:', mode);
    } catch (error) {
      console.error('[ThemeStore] Failed to save theme mode:', error);
    }
  },

  loadThemeMode: async () => {
    try {
      const storedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (
        storedMode &&
        (storedMode === 'light' || storedMode === 'dark' || storedMode === 'auto')
      ) {
        set({ themeMode: storedMode as ThemeMode });
        console.log('[ThemeStore] Loaded theme mode:', storedMode);
      }
    } catch (error) {
      console.error('[ThemeStore] Failed to load theme mode:', error);
    }
  },

  getEffectiveTheme: (systemTheme: 'light' | 'dark' | null) => {
    const { themeMode } = get();

    if (themeMode === 'auto') {
      // Follow system preference, default to dark if unknown
      return systemTheme === 'light' ? 'light' : 'dark';
    }

    return themeMode;
  }
}));
