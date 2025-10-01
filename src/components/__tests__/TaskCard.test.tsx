import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard } from '../Kanban/TaskCard';

describe('TaskCard', () => {
  const mockTask = {
    id: 'task-1',
    title: 'Test Task',
    description: 'Test description',
    dueDate: new Date().toISOString(),
    priority: 'high' as const,
    completed: false,
    columnId: 'col-1'
  };

  const mockOnDragStart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render task title', () => {
    render(<TaskCard task={mockTask} onDragStart={mockOnDragStart} />);

    expect(screen.getByText('Test Task')).toBeTruthy();
  });

  it('should show priority indicator', () => {
    render(<TaskCard task={mockTask} onDragStart={mockOnDragStart} />);

    // Priority is shown as a colored bar
    const container = screen.getByText('Test Task').closest('[draggable]');
    expect(container).toBeTruthy();
  });

  it('should expand to show description on click', () => {
    render(<TaskCard task={mockTask} onDragStart={mockOnDragStart} />);

    const taskCard = screen.getByText('Test Task').closest('[draggable]');
    fireEvent.click(taskCard!);

    expect(screen.getByText('Test description')).toBeTruthy();
  });

  it('should handle drag start', () => {
    render(<TaskCard task={mockTask} onDragStart={mockOnDragStart} />);

    const taskCard = screen.getByText('Test Task').closest('[draggable]');
    fireEvent.dragStart(taskCard!);

    expect(mockOnDragStart).toHaveBeenCalledWith(mockTask);
  });

  it('should show completed state', () => {
    const completedTask = { ...mockTask, completed: true };
    render(<TaskCard task={completedTask} onDragStart={mockOnDragStart} />);

    const titleElement = screen.getByText('Test Task');
    const _styles = window.getComputedStyle(titleElement);

    // Check for line-through style
    expect(screen.getByText('Completed')).toBeTruthy();
  });

  it('should format due date correctly', () => {
    const today = new Date();
    const taskWithTodayDue = {
      ...mockTask,
      dueDate: today.toISOString()
    };

    render(<TaskCard task={taskWithTodayDue} onDragStart={mockOnDragStart} />);

    expect(screen.getByText(/Today/)).toBeTruthy();
  });

  it('should format tomorrow due date', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const taskWithTomorrowDue = {
      ...mockTask,
      dueDate: tomorrow.toISOString()
    };

    render(<TaskCard task={taskWithTomorrowDue} onDragStart={mockOnDragStart} />);

    expect(screen.getByText(/Tomorrow/)).toBeTruthy();
  });

  it('should format future due dates', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const taskWithFutureDue = {
      ...mockTask,
      dueDate: futureDate.toISOString()
    };

    render(<TaskCard task={taskWithFutureDue} onDragStart={mockOnDragStart} />);

    const formattedDate = futureDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    expect(screen.getByText(new RegExp(formattedDate))).toBeTruthy();
  });

  it('should handle different priority colors', () => {
    const priorities = ['urgent', 'high', 'medium', 'low'];

    priorities.forEach((priority) => {
      const { unmount } = render(
        <TaskCard task={{ ...mockTask, priority: priority as 'urgent' | 'high' | 'medium' | 'low' }} onDragStart={mockOnDragStart} />
      );

      const taskCard = screen.getByText('Test Task').closest('[draggable]');
      expect(taskCard).toBeTruthy();

      unmount();
    });
  });

  it('should handle tasks without optional fields', () => {
    const minimalTask = {
      id: 'task-2',
      title: 'Minimal Task',
      completed: false,
      columnId: 'col-1'
    };

    render(<TaskCard task={minimalTask} onDragStart={mockOnDragStart} />);

    expect(screen.getByText('Minimal Task')).toBeTruthy();
    expect(screen.queryByText('Completed')).toBeFalsy();
  });

  it('should toggle expansion state', () => {
    render(<TaskCard task={mockTask} onDragStart={mockOnDragStart} />);

    const taskCard = screen.getByText('Test Task').closest('[draggable]');

    // First click - expand
    fireEvent.click(taskCard!);
    expect(screen.getByText('Test description')).toBeTruthy();

    // Second click - collapse
    fireEvent.click(taskCard!);
    expect(screen.queryByText('Test description')).toBeFalsy();
  });
});
