import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BoardPage from '../board/@boardId/+Page';
import { SpaceContext } from '../../contexts/SpaceContext';
import { usePageContext } from 'vike-react/usePageContext';
import { DialogProvider } from '../../utils/useDialogs';
import { ToasterProvider } from '../../contexts/ToasterProvider';
import { mockApi, getMockFn, getMockRoute } from '../../test/mocks/api';

// Mock vike-react/usePageContext
vi.mock('vike-react/usePageContext', () => ({
  usePageContext: vi.fn()
}));

// Mock vike/client/router
vi.mock('vike/client/router', () => ({
  navigate: vi.fn()
}));

// Mock API using shared mocks
vi.mock('../../api/client', async () => {
  const mocks = await import('../../test/mocks/api');
  return {
    api: mocks.mockApi
  };
});

const mockSpaceContext = {
  currentSpace: 'personal' as const,
  setCurrentSpace: vi.fn(),
  toggleSpace: vi.fn()
};

// Helper to wrap component with necessary providers
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SpaceContext.Provider value={mockSpaceContext}>
        <ToasterProvider>
          <DialogProvider>{ui}</DialogProvider>
        </ToasterProvider>
      </SpaceContext.Provider>
    </QueryClientProvider>
  );
};

describe('BoardPage', () => {
  const mockBoard = {
    id: 'b1',
    name: 'Main Board',
    space: 'personal',
    columns: [
      { id: 'c1', name: 'To Do', boardId: 'b1', position: 0 },
      { id: 'c2', name: 'In Progress', boardId: 'b1', position: 1 }
    ]
  };

  const mockTasks = [
    { id: 't1', title: 'Task 1', columnId: 'c1' },
    { id: 't2', title: 'Task 2', columnId: 'c2' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePageContext).mockReturnValue({
      routeParams: { boardId: 'b1' }
    } as any);

    const boardsRoute = getMockRoute(mockApi.api.boards);

    // Create stable mock objects for the board API
    const boardApiMock = {
      get: vi.fn().mockResolvedValue({ data: mockBoard, error: null }),
      summary: {
        get: vi.fn().mockResolvedValue({ data: { summary: 'Board Summary' }, error: null })
      },
      patch: vi.fn().mockResolvedValue({ data: mockBoard, error: null }),
      delete: vi.fn().mockResolvedValue({ data: {}, error: null })
    };

    getMockFn(boardsRoute).mockImplementation((params?: any) => {
      if (params && (params.id || params.boardId)) {
        return boardApiMock;
      }
      return {
        get: vi.fn().mockResolvedValue({ data: [mockBoard], error: null }),
        post: vi.fn().mockResolvedValue({ data: mockBoard, error: null })
      };
    });

    boardsRoute.get.mockResolvedValue({ data: [mockBoard], error: null });

    const tasksRoute = getMockRoute(mockApi.api.tasks);
    tasksRoute.get.mockImplementation(({ query }: any) => {
      const columnId = query?.columnId;
      const filteredTasks = columnId ? mockTasks.filter((t) => t.columnId === columnId) : mockTasks;
      return Promise.resolve({ data: filteredTasks, error: null });
    });

    getMockFn(tasksRoute['auto-organize'].post).mockResolvedValue({
      data: {
        suggestions: [
          {
            taskId: 't1',
            details: { type: 'column_move', suggestedColumnId: 'c2' },
            reason: 'Better fit'
          }
        ],
        summary: 'Auto organize summary',
        totalTasksAnalyzed: 2
      },
      error: null
    });
  });

  it('should render board and tasks', async () => {
    renderWithProviders(<BoardPage />);

    expect(await screen.findByRole('heading', { name: 'Main Board' })).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
  });

  it('should show "Board not found" if board is null', async () => {
    const boardsRoute = getMockRoute(mockApi.api.boards);
    getMockFn(boardsRoute).mockImplementation((params?: any) => {
      if (params && (params.id || params.boardId)) {
        return {
          get: vi.fn().mockResolvedValue({ data: null, error: { status: 404 } })
        };
      }
      return {
        get: vi.fn().mockResolvedValue({ data: [mockBoard], error: null })
      };
    });

    renderWithProviders(<BoardPage />);

    expect(await screen.findByText('Board not found')).toBeInTheDocument();
  });

  it('should handle "Auto Organize" click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BoardPage />);

    await screen.findByRole('heading', { name: 'Main Board' });

    const autoBtn = screen.getByRole('button', { name: /Auto Organize/i });
    await user.click(autoBtn);

    expect(await screen.findByText('Auto organize summary')).toBeInTheDocument();
  });

  it('should handle "Copy Board Summary"', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: writeTextMock
      }
    });

    renderWithProviders(<BoardPage />);

    await screen.findByRole('heading', { name: 'Main Board' });

    const optionsBtn = screen.getByLabelText('Board options');
    await user.click(optionsBtn);

    const copyBtn = await screen.findByText('Copy Board Summary');
    await user.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith('Board Summary');
  });

  it('should handle "Auto Organize" failure', async () => {
    const user = userEvent.setup();
    const tasksRoute = getMockRoute(mockApi.api.tasks);
    getMockFn(tasksRoute['auto-organize'].post).mockResolvedValue({
      data: null,
      error: { message: 'AI failed' }
    });

    renderWithProviders(<BoardPage />);
    await screen.findByRole('heading', { name: 'Main Board' });

    const autoBtn = screen.getByRole('button', { name: /Auto Organize/i });
    await user.click(autoBtn);

    // Error handled silently or via toast
  });

  it('should open "Edit Board" dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BoardPage />);

    await screen.findByRole('heading', { name: 'Main Board' });

    const optionsBtn = screen.getByLabelText('Board options');
    await user.click(optionsBtn);

    const editBtn = await screen.findByRole('menuitem', { name: /Edit Board/i });
    await user.click(editBtn);

    expect(await screen.findByRole('heading', { name: /Edit Board/i })).toBeInTheDocument();
  });
});
