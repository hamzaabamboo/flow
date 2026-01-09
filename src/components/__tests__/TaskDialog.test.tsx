import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { TaskDialog } from '../Board/TaskDialog';
// oxlint-disable-next-line no-unassigned-import
import '@testing-library/jest-dom';
import type { Task } from '../../shared/types/board';

// Mock dependencies
vi.mock('../../contexts/SpaceContext', () => ({
  useSpace: vi.fn(() => ({
    currentSpace: 'work'
  }))
}));

// Mock NotesSection to avoid complexity
vi.mock('../Notes/NotesSection', () => ({
  NotesSection: () => <div data-testid="notes-section">Notes Section</div>
}));

// Mock API client
const mockGetBoards = vi.fn();
vi.mock('../../api/client', () => ({
  api: {
    api: {
      boards: {
        get: (...args: any[]) => mockGetBoards(...args)
      }
    }
  }
}));

// Mock SimpleDatePicker
vi.mock('../ui/simple-date-picker', () => ({
  SimpleDatePicker: ({
    value,
    onChange,
    placeholder
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <input
      role="textbox"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}));

describe('TaskDialog', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnSubmit = vi.fn();
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBoards.mockResolvedValue({ data: [], error: null });
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('should render in Create mode', async () => {
    render(
      <TaskDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
        mode="create"
      />,
      { wrapper }
    );

    expect(screen.getByText('Create New Task')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter task title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Task/i })).toBeInTheDocument();
  });

  it('should handle complex form submission', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const handleSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      expect(formData.get('title')).toBe('Complex Task');
      expect(formData.get('priority')).toBe('urgent');
      expect(formData.get('recurringPattern')).toBe('weekly');
      expect(formData.get('recurringEndDate')).toContain('2026-12-31');
    });

    render(
      <TaskDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={handleSubmit}
        mode="create"
      />,
      { wrapper }
    );

    await user.type(screen.getByPlaceholderText('Enter task title'), 'Complex Task');

    // Priority - exact match
    await user.click(screen.getByLabelText(/^Urgent$/i));

    // Show advanced
    await user.click(screen.getByText(/Advanced Options/i));

    // Recurring
    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[0]);
    // Use exact name to avoid "Bi-weekly" matching "Weekly"
    const weeklyOption = await screen.findByRole('option', { name: /^Weekly$/i });
    await user.click(weeklyOption);

    // End date
    const dateInput = screen.getByPlaceholderText(/Leave empty for indefinite/i);
    fireEvent.change(dateInput, { target: { value: '2026-12-31' } });

    await user.click(screen.getByRole('button', { name: /Create Task/i }));
    expect(handleSubmit).toHaveBeenCalled();
  });

  it('should handle clearing due date', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const mockTask: Partial<Task> = {
      id: '1',
      title: 'Task',
      dueDate: '2026-01-01T10:00:00Z'
    };

    const handleSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      expect(formData.get('dueDate')).toBe('');
    });

    render(
      <TaskDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={handleSubmit}
        mode="edit"
        task={mockTask as Task}
      />,
      { wrapper }
    );

    const clearBtn = screen.getByLabelText(/Clear due date/i);
    await user.click(clearBtn);

    const saveBtn = screen.getByRole('button', { name: /Update Task/i });
    await user.click(saveBtn);
    expect(handleSubmit).toHaveBeenCalled();
  });

  it('should handle subtasks addition and removal', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <TaskDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSubmit={mockOnSubmit}
        mode="create"
      />,
      { wrapper }
    );

    await user.click(screen.getByText(/Advanced Options/i));

    const subInput = screen.getByPlaceholderText('Add subtask...');
    await user.type(subInput, 'My Subtask');

    const subtasksBox = screen.getByText('Subtasks').closest('div');
    const plusBtn = within(subtasksBox as HTMLElement).getByRole('button');
    await user.click(plusBtn);

    expect(await screen.findByText('My Subtask')).toBeInTheDocument();

    // Toggle subtask - find by checkbox near text
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[checkboxes.length - 1]);

    // Remove subtask
    const removeBtn = screen.getByLabelText('Remove subtask');
    await user.click(removeBtn);

    expect(screen.queryByText('My Subtask')).not.toBeInTheDocument();
  });
});
