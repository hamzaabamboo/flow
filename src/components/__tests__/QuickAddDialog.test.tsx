import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { QuickAddDialog } from '../QuickAdd/QuickAddDialog';
// oxlint-disable-next-line no-unassigned-import
import '@testing-library/jest-dom';
import { useToaster } from '../../contexts/ToasterContext';

// Mocks
vi.mock('../../contexts/SpaceContext', () => ({
  useSpace: vi.fn(() => ({
    currentSpace: 'work'
  }))
}));

vi.mock('../../contexts/ToasterContext', () => ({
  useToaster: vi.fn()
}));

// Enhanced Mock TaskDialog to allow triggering submit
vi.mock('../Board/TaskDialog', () => ({
  TaskDialog: ({
    open,
    onSubmit,
    task
  }: {
    open: boolean;
    onSubmit: React.FormEventHandler;
    task: { title: string };
  }) =>
    open ? (
      <div data-testid="task-dialog" data-title={task.title}>
        <form onSubmit={onSubmit}>
          <input type="hidden" name="title" defaultValue={task.title} />
          <input type="hidden" name="priority" defaultValue="high" />
          <input type="hidden" name="description" defaultValue="" />
          <input type="hidden" name="deadline" defaultValue="" />
          <input type="hidden" name="labels" defaultValue="" />
          <input type="hidden" name="columnId" defaultValue="" />
          <button type="submit">Submit Task</button>
        </form>
      </div>
    ) : null
}));

// Mock API client for tasks
const mockPost = vi.fn();
const mockTaskPost = vi.fn();
vi.mock('../../api/client', () => ({
  api: {
    api: {
      command: {
        post: (...args: unknown[]) => mockPost(...args)
      },
      tasks: {
        post: (...args: unknown[]) => mockTaskPost(...args)
      }
    }
  }
}));

describe('QuickAddDialog', () => {
  const mockOnOpenChange = vi.fn();
  const mockToast = vi.fn();
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockReset();
    mockTaskPost.mockReset();
    queryClient = new QueryClient();

    // Inject mock toast
    (useToaster as Mock).mockReturnValue({
      toast: mockToast
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('should render input when open', () => {
    render(<QuickAddDialog open={true} onOpenChange={mockOnOpenChange} />, { wrapper });
    expect(screen.getByPlaceholderText(/Type something quick/i)).toBeTruthy();
  });

  it('should not render when closed', () => {
    render(<QuickAddDialog open={false} onOpenChange={mockOnOpenChange} />, { wrapper });
    expect(screen.queryByPlaceholderText(/Type something quick/i)).toBeNull();
  });

  describe('Parsing Logic', () => {
    it('should parse successfully and open TaskDialog', async () => {
      const mockParseResult = {
        action: 'create_task',
        data: { title: 'Parsed Task', priority: 'high' }
      };
      mockPost.mockResolvedValue({ data: mockParseResult, error: null });

      const user = userEvent.setup({ pointerEventsCheck: 0 });
      render(<QuickAddDialog open={true} onOpenChange={mockOnOpenChange} />, { wrapper });

      const input = screen.getByPlaceholderText(/Type something quick/i);
      await user.type(input, 'Buy milk');
      await user.click(screen.getByText(/Open Task Dialog/i));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          expect.objectContaining({
            command: expect.stringContaining('Buy milk')
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('task-dialog')).toBeTruthy();
      });
    });

    it('should handle API errors by using raw input', async () => {
      mockPost.mockResolvedValue({ data: null, error: { message: 'Fail' } });

      const user = userEvent.setup({ pointerEventsCheck: 0 });
      render(<QuickAddDialog open={true} onOpenChange={mockOnOpenChange} />, { wrapper });

      await user.type(screen.getByPlaceholderText(/Type something quick/i), 'Raw Task');
      await user.click(screen.getByText(/Open Task Dialog/i));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.stringContaining('Failed to parse'),
          expect.anything()
        );
        expect(screen.getByTestId('task-dialog')).toHaveAttribute('data-title', 'Raw Task');
      });
    });

    it('should handle unmanaged actions by using parsing fallback', async () => {
      // API returns something valid but unknown action
      mockPost.mockResolvedValue({
        data: { action: 'unknown_action', data: {} },
        error: null
      });

      const user = userEvent.setup({ pointerEventsCheck: 0 });
      render(<QuickAddDialog open={true} onOpenChange={mockOnOpenChange} />, { wrapper });

      await user.type(screen.getByPlaceholderText(/Type something quick/i), 'Fallback Task');
      await user.click(screen.getByText(/Open Task Dialog/i));

      await waitFor(() => {
        expect(screen.getByTestId('task-dialog')).toHaveAttribute('data-title', 'Fallback Task');
      });
    });
  });

  describe('Task Submission', () => {
    it('should submit task via TaskDialog', async () => {
      // Setup: get to TaskDialog state first
      mockPost.mockResolvedValue({
        data: { action: 'create_task', data: { title: 'Submitted Task' } },
        error: null
      });
      mockTaskPost.mockResolvedValue({ data: { id: 't1' }, error: null });

      const user = userEvent.setup({ pointerEventsCheck: 0 });
      render(<QuickAddDialog open={true} onOpenChange={mockOnOpenChange} />, { wrapper });

      // Trigger parsing
      await user.type(screen.getByPlaceholderText(/Type something quick/i), 'Submitted Task');
      await user.click(screen.getByText(/Open Task Dialog/i));

      await waitFor(() => expect(screen.getByTestId('task-dialog')).toBeTruthy());

      // Click mocked submit
      await user.click(screen.getByText('Submit Task'));

      await waitFor(() => {
        expect(mockTaskPost).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Submitted Task',
            priority: 'high'
          })
        );
        expect(mockToast).toHaveBeenCalledWith(
          expect.stringMatching(/success/i),
          expect.anything()
        );
      });
    });

    it('should handle submission errors', async () => {
      // Setup: get to TaskDialog state
      mockPost.mockResolvedValue({
        data: { action: 'create_task', data: { title: 'Failed Task' } },
        error: null
      });
      mockTaskPost.mockResolvedValue({ data: null, error: 'Create Failed' }); // Error

      const user = userEvent.setup({ pointerEventsCheck: 0 });
      render(<QuickAddDialog open={true} onOpenChange={mockOnOpenChange} />, { wrapper });

      await user.type(screen.getByPlaceholderText(/Type something quick/i), 'Failed Task');
      await user.click(screen.getByText(/Open Task Dialog/i));
      await waitFor(() => expect(screen.getByTestId('task-dialog')).toBeTruthy());

      await user.click(screen.getByText('Submit Task'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.stringMatching(/failed/i), expect.anything());
      });
    });
  });

  it('should handle enter key to submit', async () => {
    const mockParseResult = { action: 'create_task', data: { title: 'Keyboard Task' } };
    mockPost.mockResolvedValue({
      data: mockParseResult,
      error: null
    });

    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<QuickAddDialog open={true} onOpenChange={mockOnOpenChange} />, { wrapper });

    const input = screen.getByPlaceholderText(/Type something quick/i);
    await user.type(input, 'Keyboard Task');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
    });
  });
});
