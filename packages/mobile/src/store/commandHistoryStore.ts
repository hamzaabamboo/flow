import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const COMMAND_HISTORY_KEY = '@hamflow:command_history';
const MAX_HISTORY_ITEMS = 10;

interface CommandHistoryState {
  history: string[];
  addToHistory: (command: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
}

export const useCommandHistoryStore = create<CommandHistoryState>((set, get) => ({
  history: [],

  addToHistory: async (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    const currentHistory = get().history;
    // Remove duplicate if exists and add to front
    const newHistory = [
      trimmedCommand,
      ...currentHistory.filter((cmd) => cmd !== trimmedCommand)
    ].slice(0, MAX_HISTORY_ITEMS);

    set({ history: newHistory });

    try {
      await AsyncStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Failed to save command history:', error);
    }
  },

  loadHistory: async () => {
    try {
      const stored = await AsyncStorage.getItem(COMMAND_HISTORY_KEY);
      if (stored) {
        const history = JSON.parse(stored);
        set({ history: Array.isArray(history) ? history : [] });
      }
    } catch (error) {
      console.error('Failed to load command history:', error);
      set({ history: [] });
    }
  },

  clearHistory: async () => {
    set({ history: [] });
    try {
      await AsyncStorage.removeItem(COMMAND_HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear command history:', error);
    }
  }
}));
