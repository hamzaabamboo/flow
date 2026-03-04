import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export type Space = 'work' | 'personal';

export interface SpaceContextType {
  currentSpace: Space;
  setCurrentSpace: (space: Space) => void;
  toggleSpace: () => void;
}

export const SpaceContext = createContext<SpaceContextType | undefined>(undefined);

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const [currentSpace, setCurrentSpace] = useState<Space>('work');

  useEffect(() => {
    // Load saved space preference
    const saved = localStorage.getItem('hamflow-space');
    if (saved === 'personal' || saved === 'work') {
      setCurrentSpace(saved);
    }
  }, []);

  const handleSetSpace = useCallback((space: Space) => {
    setCurrentSpace(space);
    localStorage.setItem('hamflow-space', space);
  }, []);

  const toggleSpace = useCallback(() => {
    handleSetSpace(currentSpace === 'work' ? 'personal' : 'work');
  }, [currentSpace, handleSetSpace]);

  const value = useMemo(
    () => ({
      currentSpace,
      setCurrentSpace: handleSetSpace,
      toggleSpace
    }),
    [currentSpace, handleSetSpace, toggleSpace]
  );

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace() {
  const context = useContext(SpaceContext);
  if (!context) {
    throw new Error('useSpace must be used within a SpaceProvider');
  }
  return context;
}
