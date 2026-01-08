import React, { createContext, useContext, useState, useEffect } from 'react';

type Space = 'work' | 'personal';

interface SpaceContextType {
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

  const handleSetSpace = (space: Space) => {
    setCurrentSpace(space);
    localStorage.setItem('hamflow-space', space);
  };

  const toggleSpace = () => {
    handleSetSpace(currentSpace === 'work' ? 'personal' : 'work');
  };

  return (
    <SpaceContext.Provider
      value={{
        currentSpace,
        setCurrentSpace: handleSetSpace,
        toggleSpace
      }}
    >
      {children}
    </SpaceContext.Provider>
  );
}

export function useSpace() {
  const context = useContext(SpaceContext);
  if (!context) {
    throw new Error('useSpace must be used within a SpaceProvider');
  }
  return context;
}
