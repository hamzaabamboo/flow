import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpaceProvider, useSpace } from '../SpaceContext';
import React from 'react';

const TestComponent = () => {
  const { currentSpace, setCurrentSpace, toggleSpace } = useSpace();
  return (
    <div>
      <span data-testid="space">{currentSpace}</span>
      <button onClick={() => setCurrentSpace('personal')}>Set Personal</button>
      <button onClick={toggleSpace}>Toggle</button>
    </div>
  );
};

describe('SpaceContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should provide default space', () => {
    render(
      <SpaceProvider>
        <TestComponent />
      </SpaceProvider>
    );
    expect(screen.getByTestId('space')).toHaveTextContent('work');
  });

  it('should load saved space from localStorage', () => {
    localStorage.setItem('hamflow-space', 'personal');
    render(
      <SpaceProvider>
        <TestComponent />
      </SpaceProvider>
    );
    // Initial render might be 'work', but useEffect should update it
    expect(screen.getByTestId('space')).toHaveTextContent('personal');
  });

  it('should update space and save to localStorage', async () => {
    render(
      <SpaceProvider>
        <TestComponent />
      </SpaceProvider>
    );

    await act(async () => {
      screen.getByText('Set Personal').click();
    });

    expect(screen.getByTestId('space')).toHaveTextContent('personal');
    expect(localStorage.getItem('hamflow-space')).toBe('personal');
  });

  it('should toggle space', async () => {
    render(
      <SpaceProvider>
        <TestComponent />
      </SpaceProvider>
    );

    await act(async () => {
      screen.getByText('Toggle').click();
    });

    expect(screen.getByTestId('space')).toHaveTextContent('personal');

    await act(async () => {
      screen.getByText('Toggle').click();
    });

    expect(screen.getByTestId('space')).toHaveTextContent('work');
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestComponent />)).toThrow('useSpace must be used within a SpaceProvider');

    consoleSpy.mockRestore();
  });
});
