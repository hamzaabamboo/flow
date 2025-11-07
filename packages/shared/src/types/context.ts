// Context related types

export interface SpaceContextType {
  currentSpace: 'work' | 'personal';
  setCurrentSpace: (space: 'work' | 'personal') => void;
}

export interface ColorModeContextValue {
  colorMode: 'light' | 'dark';
  setColorMode: (mode: 'light' | 'dark') => void;
  toggleColorMode: () => void;
}

export interface ColorModeProviderProps {
  children: React.ReactNode;
  defaultColorMode?: 'light' | 'dark';
  storageKey?: string;
}
