import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SubtaskList } from '../SubtaskList';
import { api } from '../../../api/client';

// Mock API
vi.mock('../../../api/client', () => ({
  api: {
    api: {
      subtasks: Object.assign(vi.fn(), {
        post: vi.fn(),
        task: vi.fn(() => ({
            get: vi.fn()
        })),
      })
    }
  }
}));

// Mock nested calls
const mockSubtaskPatch = vi.fn();
const mockSubtaskDelete = vi.fn();
(api.api.subtasks as any).mockImplementation((idObj: any) => ({
    patch: mockSubtaskPatch,
    delete: mockSubtaskDelete,
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('SubtaskList', () => {
  const taskId = 'task-1';
  const mockSubtasks = [
    { id: 's1', title: 'Sub 1', completed: false },
    { id: 's2', title: 'Sub 2', completed: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    
    (api.api.subtasks.task as any).mockReturnValue({
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
    
    (api.api.subtasks.post as vi.Mock).mockResolvedValue({ data: { id: 's3' }, error: null });

    await user.type(input, 'New Subtask{Enter}');

    await waitFor(() => {
        expect(api.api.subtasks.post).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Subtask' }));
    });
  });

  it('should handle toggling subtask completion', async () => {
    mockSubtaskPatch.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SubtaskList taskId={taskId} />);

    await waitFor(() => screen.getByText('Sub 1'));

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Toggle Sub 1

    await waitFor(() => {
        expect(api.api.subtasks).toHaveBeenCalledWith({ id: 's1' });
        expect(mockSubtaskPatch).toHaveBeenCalledWith({ completed: true });
    });
  });

  it('should handle subtask deletion', async () => {
    mockSubtaskDelete.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SubtaskList taskId={taskId} />);

    await waitFor(() => screen.getByText('Sub 1'));

    // Find X buttons
    const deleteBtns = screen.getAllByRole('button');
    // Sub 1 row is HStack(Checkbox, Text, IconButton(X))
    // We can use within if we identify the row
    const subRow = screen.getByText('Sub 1').closest('div');
    const xBtn = within(subRow as HTMLElement).getByRole('button');
    fireEvent.click(xBtn);

    await waitFor(() => {
        expect(api.api.subtasks).toHaveBeenCalledWith({ id: 's1' });
        expect(mockSubtaskDelete).toHaveBeenCalled();
    });
  });
});
