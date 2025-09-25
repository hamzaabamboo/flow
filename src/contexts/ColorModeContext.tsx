import React, { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

type ColorMode = 'light' | 'dark';

interface ColorModeContextValue {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
}

const ColorModeContext = createContext<ColorModeContextValue | undefined>(undefined);

export function useColorMode() {
  const context = useContext(ColorModeContext);
  if (context === undefined) {
    throw new Error('useColorMode must be used within a ColorModeProvider');
  }
  return context;
}

interface ColorModeProviderProps {
  children: ReactNode;
}

export function ColorModeProvider({ children }: ColorModeProviderProps) {
  const [colorMode, setColorMode] = useLocalStorage<ColorMode | undefined>('color-mode', undefined);

  useEffect(() => {
    const mode =
      colorMode ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }

    if (colorMode === undefined) {
      setColorMode(mode);
    }
  }, [colorMode, setColorMode]);

  const toggleColorMode = () => {
    setColorMode(colorMode === 'dark' ? 'light' : 'dark');
  };

  const value = {
    colorMode: colorMode ?? 'light',
    setColorMode,
    toggleColorMode
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            const savedSettings = localStorage.getItem('color-mode');
            if (savedSettings !== null) {
              document.documentElement.classList.add(savedSettings === '"dark"' ? 'dark' : 'light');
            } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
              document.documentElement.classList.add('dark');
              localStorage.setItem("color-mode", '"dark"');
            } else {
              document.documentElement.classList.add('light');
            }
          `
        }}
      />
      <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>
    </>
  );
}
