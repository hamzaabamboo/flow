import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Space = 'work' | 'personal';

interface SpaceState {
  currentSpace: Space;
  setSpace: (space: Space) => void;
  loadSpace: () => Promise<void>;
}

export const useSpaceStore = create<SpaceState>((set) => ({
  currentSpace: 'work',

  setSpace: async (space: Space) => {
    await AsyncStorage.setItem('currentSpace', space);
    set({ currentSpace: space });
  },

  loadSpace: async () => {
    try {
      const saved = await AsyncStorage.getItem('currentSpace');
      if (saved) {
        set({ currentSpace: saved as Space });
      }
    } catch {
      // Ignore errors
    }
  }
}));
