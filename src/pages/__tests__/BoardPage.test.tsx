import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import BoardPage from '../board/@boardId/+Page';

// oxlint-disable-next-line no-unassigned-import
import '@testing-library/jest-dom';

// Mock vike context
vi.mock('vike-react/usePageContext', () => ({
  usePageContext: () => ({
    routeParams: { boardId: 'b1' }
  })
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('vike/client/router', () => ({
  navigate: (...args: any[]) => mockNavigate(...args)
}));

// Mock SpaceContext with correct path
vi.mock('../../contexts/SpaceContext', () => ({
  useSpace: vi.fn(() => ({
    currentSpace: 'work'
  }))
}));

// Mock ToasterContext
vi.mock('../../contexts/ToasterContext', () => ({
  useToaster: () => ({
    toast: vi.fn()
  })
}));

// Mock API
const mockBoardGet = vi.fn();
const mockTasksGet = vi.fn();

vi.mock('../../api/client', () => ({
  api: {
    api: {
      boards: Object.assign(
        (params: any) => ({
          get: (...args: any[]) => mockBoardGet(params, ...args),
          summary: { get: vi.fn().mockResolvedValue({ data: { summary: 'mock summary' } }) }
        }),
        {
          get: (...args: any[]) => mockBoardGet(...args)
        }
      ),
      tasks: Object.assign(
        (params: any) => ({
          get: (...args: any[]) => mockTasksGet(params, ...args)
        }),
        {
          get: (...args: any[]) => mockTasksGet(...args)
        }
      )
    }
  }
}));

// Mock KanbanBoard with distinct text to avoid confusion with Header
vi.mock('../../components/Board/KanbanBoard', () => ({
  KanbanBoard: ({ board, tasks }: any) => (
    <div data-testid="kanban-board">
      <h3>Kanban for {board.name}</h3>
      <div>Tasks Count: {tasks?.length}</div>
    </div>
  )
}));

// Mock Dialogs
vi.mock('../../components/AutoOrganize/AutoOrganizeDialog', () => ({
  AutoOrganizeDialog: () => <div data-testid="auto-organize-dialog" />
}));

vi.mock('../../components/Board/BoardDialog', () => ({
  BoardDialog: ({ open }: any) => (open ? <div data-testid="edit-board-dialog" /> : null)
}));

describe('BoardPage Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });

    // Default mocks
    mockBoardGet.mockResolvedValue({
      data: { id: 'b1', name: 'Test Board', space: 'work', columns: [{ id: 'c1', name: 'Col 1' }] },
      error: null
    });
    mockTasksGet.mockResolvedValue({ data: [], error: null });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('should render board details', async () => {
    render(<BoardPage />, { wrapper });

    // Use getAllByText because title appears in Header and Mock
    await waitFor(() => {
      const titles = screen.getAllByText(/Test Board/i);
      expect(titles.length).toBeGreaterThan(0);
      expect(screen.getByTestId('kanban-board')).toBeInTheDocument();
    });
  });

  it('should load tasks for columns', async () => {
    mockTasksGet.mockResolvedValue({
      data: [{ id: 't1', title: 'Task 1' }],
      error: null
    });

    render(<BoardPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Tasks Count: 1')).toBeInTheDocument();
    });
  });

  it('should handle navigation back to boards', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<BoardPage />, { wrapper });

    await waitFor(() => expect(screen.getAllByText(/Test Board/i).length).toBeGreaterThan(0));

    const backBtn = screen.getByLabelText('Back to boards');
    await user.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should open Edit Board dialog', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<BoardPage />, { wrapper });

    await waitFor(() => expect(screen.getAllByText(/Test Board/i).length).toBeGreaterThan(0));

    // Menu interaction
    const menuBtn = screen.getByLabelText('Board options');
    await user.click(menuBtn);

    const editOption = screen.getByText('Edit Board');
    await user.click(editOption);

    expect(screen.getByTestId('edit-board-dialog')).toBeInTheDocument();
  });
});
