import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TaskItem } from '../TaskItem';
import type { CalendarEvent } from '../../../shared/types/calendar';

describe('TaskItem', () => {
  const mockEvent: CalendarEvent = {
    id: 'task-1',
    title: 'Test Task',
    priority: 'high',
    dueDate: '2024-12-25T10:00:00Z',
    labels: ['work', 'urgent'],
    noteId: 'note-1',
    completed: false
  };

  const onToggleComplete = vi.fn();
  const onTaskClick = vi.fn();

  it('should render task details correctly', () => {
    render(
      <TaskItem 
        event={mockEvent} 
        onToggleComplete={onToggleComplete} 
        onTaskClick={onTaskClick} 
      />
    );

    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('work')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('should call onToggleComplete when checkbox is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TaskItem 
        event={mockEvent} 
        onToggleComplete={onToggleComplete} 
        onTaskClick={onTaskClick} 
      />
    );

    await user.click(screen.getByRole('checkbox'));
    expect(onToggleComplete).toHaveBeenCalled();
  });

  it('should call onTaskClick when task card is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TaskItem 
        event={mockEvent} 
        onToggleComplete={onToggleComplete} 
        onTaskClick={onTaskClick} 
      />
    );

    // The card is the first child of the fragment
    await user.click(container.firstChild as HTMLElement);
    expect(onTaskClick).toHaveBeenCalled();
  });

  it('should render external event differently', () => {
    const externalEvent: CalendarEvent = {
      ...mockEvent,
      type: 'external',
      externalCalendarName: 'Google Cal',
      externalCalendarColor: 'blue'
    };

    render(
      <TaskItem 
        event={externalEvent} 
        onToggleComplete={onToggleComplete} 
        onTaskClick={onTaskClick} 
      />
    );

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('Google Cal')).toBeInTheDocument();
  });

  it('should handle carry over for overdue tasks', async () => {
    const user = userEvent.setup();
    const overdueEvent: CalendarEvent = {
      ...mockEvent,
      dueDate: '2020-01-01T00:00:00Z', // Past date
    };
    const onCarryOver = vi.fn();

    render(
      <TaskItem 
        event={overdueEvent} 
        onToggleComplete={onToggleComplete} 
        onTaskClick={onTaskClick} 
        onCarryOver={onCarryOver}
        hideCheckboxOnOverdue={true}
      />
    );

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('Carry Over')).toBeInTheDocument();

    await user.click(screen.getByText('Carry Over'));
    // Use getAllByText because both the toggle button and dialog have 'Cancel'
    expect(screen.getAllByText('Cancel').length).toBeGreaterThan(0);
  });
});
