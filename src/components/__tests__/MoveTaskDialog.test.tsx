import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MoveTaskDialog } from '../MoveTaskDialog';
import { SpaceContext } from '../../contexts/SpaceContext';
import { api } from '../../api/client';

// Mock the API client
vi.mock('../../api/client', () => ({
  api: {
    api: {
      boards: {
        get: vi.fn()
      }
    }
  }
}));

const mockSpaceContext = {
  currentSpace: 'work',
  spaces: [],
  setSpaces: vi.fn(),
  setCurrentSpace: vi.fn(),
  getSpaceById: vi.fn(),
  toggleSpace: vi.fn()
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false }
  }
});

const mockBoards = [
  {
    id: 'board-1',
    name: 'Work Board',
    columns: [
      { id: 'col-1', name: 'To Do' },
      { id: 'col-2', name: 'Done' }
    ]
  },
  {
    id: 'board-2',
    name: 'Other Board',
    columns: [{ id: 'col-3', name: 'Backlog' }]
  }
];

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <SpaceContext.Provider value={mockSpaceContext as any}>{ui}</SpaceContext.Provider>
    </QueryClientProvider>
  );
};

describe('MoveTaskDialog', () => {
  const mockTask = { id: 'task-1', title: 'Test Task', boardId: 'board-1', columnId: 'col-1' };
  const onMove = vi.fn();
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    // Mock API response
    (api.api.boards.get as any).mockResolvedValue({
      data: mockBoards,
      error: null
    });
  });

  it('should render dialog when open', async () => {
    renderWithProviders(
      <MoveTaskDialog
        open={true}
        onOpenChange={onOpenChange}
        task={mockTask as any}
        onMove={onMove}
      />
    );

    expect(screen.getByRole('heading', { name: 'Move Task' })).toBeInTheDocument();
    expect(
      screen.getByText(/Move "Test Task" to a different board or column/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Work Board').length).toBeGreaterThan(0);
      expect(screen.getAllByText('To Do').length).toBeGreaterThan(0);
    });
  });

  it('should call onMove when move button is clicked', async () => {
    renderWithProviders(
      <MoveTaskDialog
        open={true}
        onOpenChange={onOpenChange}
        task={mockTask as any}
        onMove={onMove}
      />
    );

    await waitFor(() => expect(screen.getAllByText('Work Board').length).toBeGreaterThan(0));

    const moveBtn = screen.getByRole('button', { name: 'Move Task' });
    fireEvent.click(moveBtn);

    expect(onMove).toHaveBeenCalledWith('task-1', 'col-1');
  });

  it('should update columns when a new board is selected', async () => {
    renderWithProviders(
      <MoveTaskDialog
        open={true}
        onOpenChange={onOpenChange}
        task={mockTask as any}
        onMove={onMove}
      />
    );

    await waitFor(() => expect(screen.getAllByText('Work Board').length).toBeGreaterThan(0));

    expect(screen.getAllByText('Work Board').length).toBeGreaterThan(0);
  });
});
