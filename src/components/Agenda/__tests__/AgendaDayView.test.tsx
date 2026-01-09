import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AgendaDayView } from '../AgendaDayView';
import type { CalendarEvent } from '../../../shared/types/calendar';
import { addHours, startOfDay } from 'date-fns';

describe('AgendaDayView', () => {
  const now = new Date();
  const selectedDate = startOfDay(now);

  const mockEvents: CalendarEvent[] = [
    {
      id: '1',
      title: 'Task 1',
      dueDate: addHours(now, 2).toISOString(), // Future
      type: 'task',
      completed: false,
      instanceDate: '2026-01-07',
      space: 'work'
    },
    {
      id: '2',
      title: 'Task 2',
      dueDate: addHours(now, 1).toISOString(), // Earlier future
      type: 'task',
      completed: false,
      instanceDate: '2026-01-07',
      space: 'work'
    },
    {
      id: '3',
      title: 'Task 3',
      dueDate: undefined,
      type: 'task',
      completed: false,
      instanceDate: '2026-01-07',
      space: 'work'
    }
  ];

  const mockHandlers = {
    onToggleComplete: vi.fn(),
    onTaskClick: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    onCarryOver: vi.fn(),
    onCreateCopy: vi.fn()
  };

  it('should render events sorted by time', () => {
    render(<AgendaDayView selectedDate={selectedDate} events={mockEvents} {...mockHandlers} />);

    const taskTitles = screen.getAllByText(/Task \d/).map((el) => el.textContent?.trim());
    // Task 2 is 1h from now, Task 1 is 2h from now, Task 3 has no time
    expect(taskTitles).toEqual(['Task 2', 'Task 1', 'Task 3']);
  });

  it('should sort tasks correctly when first has no due date and second has one', () => {
    const events: CalendarEvent[] = [
      { ...mockEvents[2], id: '3', title: 'Task 3' }, // No due date
      { ...mockEvents[0], id: '1', title: 'Task 1' } // Has due date
    ];
    render(<AgendaDayView selectedDate={selectedDate} events={events} {...mockHandlers} />);
    const taskTitles = screen.getAllByText(/Task \d/).map((el) => el.textContent?.trim());
    expect(taskTitles).toEqual(['Task 1', 'Task 3']);
  });

  it('should call onTaskClick when task title is clicked', async () => {
    const user = userEvent.setup();
    render(
      <AgendaDayView selectedDate={selectedDate} events={[mockEvents[0]]} {...mockHandlers} />
    );

    const title = screen.getByText('Task 1');
    await user.click(title);
    expect(mockHandlers.onTaskClick).toHaveBeenCalled();
  });

  it('should call onToggleComplete when checkbox clicked', async () => {
    const user = userEvent.setup();
    render(
      <AgendaDayView selectedDate={selectedDate} events={[mockEvents[0]]} {...mockHandlers} />
    );

    const checkbox = screen.getByRole('checkbox', { name: /Complete task: Task 1/i });
    await user.click(checkbox);

    expect(mockHandlers.onToggleComplete).toHaveBeenCalled();
  });

  it('should render board and column names as badges', () => {
    const eventWithBoard: CalendarEvent = {
      ...mockEvents[0],
      id: '4',
      title: 'Board Task',
      boardName: 'Work Board',
      columnName: 'To Do'
    };

    render(
      <AgendaDayView selectedDate={selectedDate} events={[eventWithBoard]} {...mockHandlers} />
    );

    expect(screen.getByText('Work Board')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
  });

  it('should render "No tasks scheduled" when events array is empty', () => {
    render(<AgendaDayView selectedDate={selectedDate} events={[]} {...mockHandlers} />);

    expect(screen.getByText('No tasks scheduled')).toBeInTheDocument();
  });
});
