import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HabitsCard } from '../HabitsCard';
import type { Habit } from '../../../shared/types/calendar';

describe('HabitsCard', () => {
  const mockHabits: Habit[] = [
    { id: 'h1', name: 'Exercise', completedToday: false, frequency: 'daily', currentStreak: 5 },
    { id: 'h2', name: 'Read', completedToday: true, frequency: 'daily', currentStreak: 3 },
  ];

  const mockHandlers = {
    onToggleHabit: vi.fn(),
    onCompleteAll: vi.fn(),
  };

  it('should render loading state', () => {
    render(
      <HabitsCard 
        habits={undefined} 
        isLoading={true} 
        isError={false} 
        {...mockHandlers} 
      />
    );
    expect(screen.getByText('Loading habits...')).toBeInTheDocument();
  });

  it('should render error state', () => {
    render(
      <HabitsCard 
        habits={undefined} 
        isLoading={false} 
        isError={true} 
        {...mockHandlers} 
      />
    );
    expect(screen.getByText('Error loading habits')).toBeInTheDocument();
  });

  it('should render list of habits', () => {
    render(
      <HabitsCard 
        habits={mockHabits} 
        isLoading={false} 
        isError={false} 
        {...mockHandlers} 
      />
    );

    expect(screen.getByText('Exercise')).toBeInTheDocument();
    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.getByText('🔥5')).toBeInTheDocument();
    expect(screen.getByText('🔥3')).toBeInTheDocument();
  });

  it('should call onToggleHabit when a habit is clicked', () => {
    render(
      <HabitsCard 
        habits={mockHabits} 
        isLoading={false} 
        isError={false} 
        {...mockHandlers} 
      />
    );

    fireEvent.click(screen.getByText('Exercise'));
    expect(mockHandlers.onToggleHabit).toHaveBeenCalledWith(mockHabits[0]);
  });

  it('should call onCompleteAll when button is clicked', () => {
    render(
      <HabitsCard 
        habits={mockHabits} 
        isLoading={false} 
        isError={false} 
        {...mockHandlers} 
      />
    );

    const completeAllBtn = screen.getByText('Complete All');
    fireEvent.click(completeAllBtn);
    expect(mockHandlers.onCompleteAll).toHaveBeenCalled();
  });

  it('should show empty state message', () => {
    render(
      <HabitsCard 
        habits={[]} 
        isLoading={false} 
        isError={false} 
        {...mockHandlers} 
      />
    );
    expect(screen.getByText('No habits yet')).toBeInTheDocument();
  });
});
