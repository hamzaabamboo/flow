import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SubtaskList } from '../SubtaskList';
import { mockApi, getMockFn, getMockRoute, asMock } from '../../../test/mocks/api';

// Correctly mock using dynamic import to avoid hoisting issues with shared mocks
vi.mock('../../../api/client', async () => {
  const mocks = await import('../../../test/mocks/api');
  return {
    api: mocks.mockApi
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('SubtaskList', () => {
  const taskId = 'task-1';
  const mockSubtasks = [
    {
      id: 's1',
      taskId,
      title: 'Sub 1',
      completed: false,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 's2',
      taskId,
      title: 'Sub 2',
      completed: true,
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    // Access the shared mock directly
    const subtasks = getMockRoute(mockApi.api.subtasks);

    // We mock the .task({}).get() chain
    getMockFn(asMock(subtasks.task)).mockReturnValue({
      get: vi.fn().mockResolvedValue({ data: mockSubtasks, error: null })
    });
  });

  it('should render list of subtasks', async () => {
    renderWithProviders(<SubtaskList taskId={taskId} />);

    await waitFor(() => {
      expect(screen.getByText('Sub 1')).toBeInTheDocument();
      expect(screen.getByText('Sub 2')).toBeInTheDocument();
      expect(screen.getByText(/Subtasks \(1\/2\)/)).toBeInTheDocument();
    });
  });

  it('should render in compact mode', async () => {
    renderWithProviders(<SubtaskList taskId={taskId} compact={true} />);

    await waitFor(() => {
      expect(screen.getByText('1/2')).toBeInTheDocument();
      expect(screen.getByText('subtasks')).toBeInTheDocument();
      expect(screen.queryByText('Sub 1')).not.toBeInTheDocument();
    });
  });

  it('should handle adding a new subtask', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SubtaskList taskId={taskId} />);

    await waitFor(() => screen.getByText('Sub 1'));

    // Must click Plus button first if subtasks exist
    fireEvent.click(screen.getByLabelText('Add subtask'));

    const input = await screen.findByPlaceholderText('Add subtask...');

    // Setup post response
    getMockRoute(mockApi.api.subtasks).post.mockResolvedValue({ data: { id: 's3' }, error: null });

    await user.type(input, 'New Subtask{Enter}');

    await waitFor(() => {
      expect(mockApi.api.subtasks.post).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Subtask' })
      );
    });
  });

  it('should handle toggling subtask completion', async () => {
    // subtasks({ id }) is a function call on the route
    const subtasksRoute = getMockRoute(mockApi.api.subtasks);

    const itemMock = {
      patch: vi.fn().mockResolvedValue({ data: {}, error: null }),
      delete: vi.fn(),
      get: vi.fn(),
      post: vi.fn()
    };

    getMockFn(subtasksRoute).mockReturnValue(itemMock);

    renderWithProviders(<SubtaskList taskId={taskId} />);

    await waitFor(() => screen.getByText('Sub 1'));

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Toggle Sub 1

    await waitFor(() => {
      expect(subtasksRoute).toHaveBeenCalledWith({ id: 's1' });
      expect(itemMock.patch).toHaveBeenCalledWith({ completed: true });
    });
  });

  it('should handle subtask deletion', async () => {
    const subtasksRoute = getMockRoute(mockApi.api.subtasks);

    const itemMock = {
      delete: vi.fn().mockResolvedValue({ data: {}, error: null }),
      patch: vi.fn(),
      get: vi.fn(),
      post: vi.fn()
    };

    getMockFn(subtasksRoute).mockReturnValue(itemMock);

    renderWithProviders(<SubtaskList taskId={taskId} />);

    await waitFor(() => screen.getByText('Sub 1'));

    const subRow = screen.getByText('Sub 1').closest('div');
    const buttons = within(subRow as HTMLElement).getAllByRole('button');

    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(subtasksRoute).toHaveBeenCalledWith({ id: 's1' });
      expect(itemMock.delete).toHaveBeenCalled();
    });
  });
});
