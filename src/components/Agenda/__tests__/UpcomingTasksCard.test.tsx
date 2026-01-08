import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { UpcomingTasksCard } from '../UpcomingTasksCard';
import type { CalendarEvent } from '../../../shared/types/calendar';

describe('UpcomingTasksCard', () => {
  const mockTasks: CalendarEvent[] = [
    { 
        id: '1', 
        title: 'Task 1', 
        dueDate: '2026-01-10T10:00:00Z',
        type: 'task',
        completed: false,
        instanceDate: '2026-01-10',
        space: 'work'
    },
    { 
        id: '2', 
        title: 'Task 2', 
        dueDate: undefined,
        type: 'task',
        completed: false,
        instanceDate: '',
        space: 'personal'
    },
  ];

  const mockHandlers = {
    onToggleComplete: vi.fn(),
    onTaskClick: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    onCreateCopy: vi.fn(),
  };

  it('should render list of upcoming tasks', () => {
    render(<UpcomingTasksCard tasks={mockTasks} {...mockHandlers} />);

    expect(screen.getByText('Upcoming & Unscheduled')).toBeInTheDocument();
    expect(screen.getByText('2 tasks')).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
  });

  it('should call onToggleComplete when checkbox clicked', async () => {
    const user = userEvent.setup();
    render(<UpcomingTasksCard tasks={mockTasks} {...mockHandlers} />);

    const checkbox = screen.getByRole('checkbox', { name: /Complete task: Task 1/i });
    await user.click(checkbox);
    expect(mockHandlers.onToggleComplete).toHaveBeenCalled();
  });

  it('should call onTaskClick when task title is clicked', async () => {
    const user = userEvent.setup();
    render(<UpcomingTasksCard tasks={mockTasks} {...mockHandlers} />);

    const title = screen.getByText('Task 1');
    await user.click(title);
    expect(mockHandlers.onTaskClick).toHaveBeenCalled();
  });

  it('should return null when no tasks', () => {
    const { container } = render(<UpcomingTasksCard tasks={[]} {...mockHandlers} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render board and column names as badges', () => {
    const tasksWithBoard: CalendarEvent[] = [
      {
        ...mockTasks[0],
        boardName: 'Work Board',
        columnName: 'To Do'
      }
    ];

    render(<UpcomingTasksCard tasks={tasksWithBoard} {...mockHandlers} />);

    expect(screen.getByText('Work Board')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
  });

  it('should call callbacks for task actions', async () => {
    const user = userEvent.setup();
    render(<UpcomingTasksCard tasks={[mockTasks[0]]} {...mockHandlers} />);

    // Upcoming tasks never have checkboxes in this view, titles are clickable
    await user.click(screen.getByText('Task 1'));
    expect(mockHandlers.onTaskClick).toHaveBeenCalled();

    // Menu actions
    await user.click(screen.getByLabelText(/Task actions/i));
    
    await user.click(await screen.findByRole('menuitem', { name: /Duplicate/i }));
    expect(mockHandlers.onDuplicate).toHaveBeenCalled();

    await user.click(screen.getByLabelText(/Task actions/i));
    await user.click(await screen.findByRole('menuitem', { name: /Delete/i }));
    expect(mockHandlers.onDelete).toHaveBeenCalled();

    await user.click(screen.getByLabelText(/Task actions/i));
    await user.click(await screen.findByRole('menuitem', { name: /Move to Board/i }));
    expect(mockHandlers.onMove).toHaveBeenCalled();
  });

  it('should call onCreateCopy for external events', async () => {
    const user = userEvent.setup();
    const extTask: CalendarEvent = { 
        ...mockTasks[0], 
        type: 'external', 
        id: 'ext-1' 
    };
    render(<UpcomingTasksCard tasks={[extTask]} {...mockHandlers} />);

    await user.click(screen.getByRole('button', { name: /Create Task/i }));
    expect(mockHandlers.onCreateCopy).toHaveBeenCalled();
  });
});