import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BoardPage from '../board/@boardId/+Page';
import { SpaceContext } from '../../contexts/SpaceContext';
import { api } from '../../api/client';
import { usePageContext } from 'vike-react/usePageContext';
import { DialogProvider } from '../../utils/useDialogs';
import { ToasterProvider } from '../../contexts/ToasterProvider';

// Mock vike-react/usePageContext
vi.mock('vike-react/usePageContext', () => ({
  usePageContext: vi.fn(),
}));

// Mock vike/client/router
vi.mock('vike/client/router', () => ({
  navigate: vi.fn(),
}));

// Mock API client
vi.mock('../../api/client', () => {
  const boardsMock: any = vi.fn(() => ({
    get: vi.fn(),
    summary: { get: vi.fn() }
  }));
  const tasksMock: any = vi.fn(() => ({
    get: vi.fn(),
    patch: vi.fn()
  }));
  // Add auto-organize property to tasksMock
  tasksMock['auto-organize'] = {
    post: vi.fn()
  };

  return {
    api: {
      api: {
        boards: boardsMock,
        tasks: tasksMock
      }
    }
  };
});

// Helper to wrap component with necessary providers
const renderWithProviders = (ui: React.ReactElement, currentSpace = 'personal') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SpaceContext.Provider value={{ currentSpace, setCurrentSpace: vi.fn() }}>
        <ToasterProvider>
          <DialogProvider>
            {ui}
          </DialogProvider>
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
      { id: 'c1', name: 'To Do' },
      { id: 'c2', name: 'In Progress' }
    ]
  };

  const mockTasks = [
    { id: 't1', title: 'Task 1', columnId: 'c1' },
    { id: 't2', title: 'Task 2', columnId: 'c2' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (usePageContext as any).mockReturnValue({
      routeParams: { boardId: 'b1' }
    });

    const apiMock = api.api as any;
    apiMock.boards.mockImplementation(() => ({
        get: vi.fn().mockResolvedValue({ data: mockBoard, error: null }),
        summary: {
            get: vi.fn().mockResolvedValue({ data: { summary: 'Board Summary' }, error: null })
        }
    }));

    apiMock.tasks.mockImplementation((params: any) => ({
        get: vi.fn().mockResolvedValue({ 
            data: mockTasks.filter(t => t.columnId === params.id), 
            error: null 
        }),
        patch: vi.fn().mockResolvedValue({ data: {}, error: null })
    }));

    // Explicitly set the auto-organize mock in beforeEach to ensure it's there
    apiMock.tasks['auto-organize'] = {
        post: vi.fn().mockResolvedValue({
            data: {
                suggestions: [{ 
                    taskId: 't1', 
                    details: { type: 'column_move', suggestedColumnId: 'c2' },
                    reason: 'Better fit' 
                }],
                summary: 'Auto organize summary',
                totalTasksAnalyzed: 2
            },
            error: null
        })
    };
  });

  it('should render loading state initially', () => {
    const apiMock = api.api as any;
    apiMock.boards.mockImplementation(() => ({
        get: new Promise(() => {}) 
    }));

    renderWithProviders(<BoardPage />);
    expect(screen.getByText(/Loading board/i)).toBeInTheDocument();
  });

  it('should render board and tasks', async () => {
    renderWithProviders(<BoardPage />);

    expect(await screen.findByText('Main Board')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
  });

  it('should show "Board not found" if board is null', async () => {
    const apiMock = api.api as any;
    apiMock.boards.mockImplementation(() => ({
        get: vi.fn().mockResolvedValue({ data: null, error: { status: 404 } })
    }));

    renderWithProviders(<BoardPage />);

    expect(await screen.findByText('Board not found')).toBeInTheDocument();
  });

  it('should handle "Auto Organize" click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BoardPage />);

    await waitFor(() => expect(screen.getByText('Main Board')).toBeInTheDocument());

    const autoBtn = screen.getByRole('button', { name: /Auto Organize/i });
    await user.click(autoBtn);

    // Wait for dialog to open - The title is "Auto Organize" but there's also a button with that text.
    // We can check for the summary text which is unique to the dialog.
    expect(await screen.findByText('Auto organize summary')).toBeInTheDocument();
  });

  it('should handle "Copy Board Summary"', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    renderWithProviders(<BoardPage />);

    await waitFor(() => expect(screen.getByText('Main Board')).toBeInTheDocument());

    const optionsBtn = screen.getByLabelText('Board options');
    await user.click(optionsBtn);

    const copyBtn = await screen.findByText('Copy Board Summary');
    await user.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith('Board Summary');
  });

  it('should handle "Copy Board Summary" failure', async () => {
    const user = userEvent.setup();
    const apiMock = api.api as any;
    apiMock.boards.mockImplementation(() => ({
        get: vi.fn().mockResolvedValue({ data: mockBoard, error: null }),
        summary: {
            get: vi.fn().mockResolvedValue({ data: null, error: { message: 'Failed' } })
        }
    }));

    renderWithProviders(<BoardPage />);
    await screen.findByText('Main Board');

    await user.click(screen.getByLabelText('Board options'));
    await user.click(screen.getByText('Copy Board Summary'));

    // Should not crash and potentially show toast
  });

  it('should handle "Auto Organize" failure', async () => {
    const user = userEvent.setup();
    const apiMock = api.api as any;
    apiMock.tasks['auto-organize'].post.mockResolvedValue({
        data: null,
        error: { message: 'AI failed' }
    });

    renderWithProviders(<BoardPage />);
    await screen.findByText('Main Board');

    const autoBtn = screen.getByRole('button', { name: /Auto Organize/i });
    await user.click(autoBtn);

    // Should show error toast
  });

  it('should open "Edit Board" dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BoardPage />);

    await waitFor(() => expect(screen.getByText('Main Board')).toBeInTheDocument());

    const optionsBtn = screen.getByLabelText('Board options');
    await user.click(optionsBtn);

    const editBtn = await screen.findByRole('menuitem', { name: /Edit Board/i });
    await user.click(editBtn);

    expect(await screen.findByRole('heading', { name: /Edit Board/i })).toBeInTheDocument();
  });
});
