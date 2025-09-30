import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useColorMode } from '../../contexts/ColorModeContext';
import { IconButton } from '../ui/icon-button';

export function ColorModeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <IconButton
      onClick={toggleColorMode}
      variant="ghost"
      aria-label={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}
    >
      {colorMode === 'dark' ? <Sun width="20" height="20" /> : <Moon width="20" height="20" />}
    </IconButton>
  );
}
