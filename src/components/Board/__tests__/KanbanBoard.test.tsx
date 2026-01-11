import { render, screen, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KanbanBoard } from '../KanbanBoard';
import { SpaceContext } from '../../../contexts/SpaceContext';
import { DialogProvider } from '../../../utils/useDialogs';
import type { BoardWithColumns, Task } from '../../../shared/types';
import { mockApi, getMockRoute, getMockFn } from '../../../test/mocks/api';
import type { DragOverEvent, DragEndEvent } from '@dnd-kit/core';

// Correctly mock using dynamic import to avoid hoisting issues
vi.mock('../../../api/client', async () => {
  const mocks = await import('../../../test/mocks/api');
  return {
    api: mocks.mockApi
  };
});

const mockSpaceContext = {
  currentSpace: 'work' as const,
  spaces: [],
  setSpaces: vi.fn(),
  setCurrentSpace: vi.fn(),
  getSpaceById: vi.fn(),
  toggleSpace: vi.fn()
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const ToasterProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const renderWithProviders = (ui: React.ReactElement) => {
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

// Interface for captured DndProps to avoid 'any'
interface DndProps {
  children: React.ReactNode;
  onDragOver?: (event: unknown) => void;
  onDragEnd?: (event: unknown) => void;
}

// Mock DndContext to capture props
vi.mock('@dnd-kit/core', async () => {
  const actual = (await vi.importActual('@dnd-kit/core')) as unknown as object;
  return {
    ...actual,
    DndContext: (props: DndProps) => {
      (globalThis as unknown as { lastDndProps: DndProps }).lastDndProps = props;
      return <div data-testid="dnd-context">{props.children}</div>;
    },
    // Mock sensors to avoid initialization issues
    useSensor: vi.fn(),
    useSensors: vi.fn(),
    PointerSensor: vi.fn(),
    TouchSensor: vi.fn()
  };
});

describe('KanbanBoard', () => {
  const mockBoard: BoardWithColumns = {
    id: 'board-1',
    name: 'Work Board',
    space: 'work',
    columnOrder: ['col-1'],
    columns: [
      {
        id: 'col-1',
        name: 'To Do',
        position: 0,
        taskOrder: [],
        boardId: 'board-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  };

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Task 1',
      columnId: 'col-1',
      priority: 'high',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completed: false
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    // Setup implementation using type-safe helpers
    const tasksRoute = getMockRoute(mockApi.api.tasks);
    const columnsRoute = getMockRoute(mockApi.api.columns);
    const boardsRoute = getMockRoute(mockApi.api.boards);

    const itemMock = {
      patch: vi.fn().mockResolvedValue({ data: {}, error: null }),
      delete: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
      get: vi.fn(),
      post: vi.fn()
    };

    getMockFn(tasksRoute).mockReturnValue(itemMock);
    getMockFn(columnsRoute).mockReturnValue(itemMock);

    boardsRoute.get.mockResolvedValue({ data: [mockBoard], error: null });
  });

  it('should render board columns and tasks', () => {
    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);
    expect(screen.getByText('To Do (1)')).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
  });

  it('should handle column editing (rename)', async () => {
    const user = userEvent.setup();
    const columnsRoute = getMockRoute(mockApi.api.columns);
    const mockPatch = vi.fn().mockResolvedValue({ data: {}, error: null });
    getMockFn(columnsRoute).mockReturnValue({
      patch: mockPatch,
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn()
    });

    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);

    await user.click(screen.getByLabelText(/Column options/i));

    const editBtn = await screen.findByRole('menuitem', { name: /Edit Column/i });
    await user.click(editBtn);

    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByDisplayValue('To Do');
    await user.clear(input);
    await user.type(input, 'New Name');

    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(mockPatch).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }));
  });

  it('should handle adding a new column', async () => {
    const user = userEvent.setup();
    const columnsRoute = getMockRoute(mockApi.api.columns);
    columnsRoute.post.mockResolvedValue({ data: { id: 'col-2', name: 'Done' }, error: null });

    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);

    await user.click(screen.getByText(/Add Column/i));

    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByPlaceholderText(/Enter column name/i);
    await user.type(input, 'Done');

    await user.click(within(dialog).getByRole('button', { name: /Create Column/i }));

    expect(columnsRoute.post).toHaveBeenCalledWith(expect.objectContaining({ name: 'Done' }));
  });

  it('should handle column deletion', async () => {
    const user = userEvent.setup();
    const columnsRoute = getMockRoute(mockApi.api.columns);
    const mockDelete = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
    getMockFn(columnsRoute).mockReturnValue({
      delete: mockDelete,
      patch: vi.fn(),
      get: vi.fn(),
      post: vi.fn()
    });

    renderWithProviders(<KanbanBoard board={mockBoard} tasks={[]} />);

    await user.click(screen.getByLabelText(/Column options/i));
    const deleteBtn = await screen.findByRole('menuitem', { name: /Delete Column/i });
    await user.click(deleteBtn);

    const confirmBtn = await screen.findByRole('button', { name: /Delete/i });
    await user.click(confirmBtn);

    expect(mockDelete).toHaveBeenCalled();
  });

  it('should handle task deletion', async () => {
    const user = userEvent.setup();
    const tasksRoute = getMockRoute(mockApi.api.tasks);
    const mockDelete = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
    getMockFn(tasksRoute).mockReturnValue({
      delete: mockDelete,
      patch: vi.fn(),
      get: vi.fn(),
      post: vi.fn()
    });

    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);

    await user.click(screen.getByLabelText(/Task actions/i));
    const deleteBtn = await screen.findByRole('menuitem', { name: /Delete/i });
    await user.click(deleteBtn);

    expect(mockDelete).toHaveBeenCalled();
  });

  it('should handle dragging a task over another column (move)', async () => {
    const tasksRoute = getMockRoute(mockApi.api.tasks);
    const mockPatch = vi.fn().mockResolvedValue({ data: {}, error: null });
    getMockFn(tasksRoute).mockReturnValue({
      patch: mockPatch,
      delete: vi.fn(),
      get: vi.fn(),
      post: vi.fn()
    });

    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);

    const dndProps = (globalThis as unknown as { lastDndProps: DndProps }).lastDndProps;

    await waitFor(() => expect(dndProps.onDragOver).toBeDefined());

    if (dndProps.onDragOver) {
      await act(async () => {
        dndProps.onDragOver!({
          active: { id: 'task-1', data: { current: { type: 'task' } } },
          over: { id: 'col-2', data: { current: { type: 'column' } } }
        } as unknown as DragOverEvent);
      });
    }

    expect(mockPatch).toHaveBeenCalledWith(expect.objectContaining({ columnId: 'col-2' }));
  });

  it('should handle dragging a task over another task in same column (reorder)', async () => {
    const tasksRoute = getMockRoute(mockApi.api.tasks);
    const reorderPost = getMockFn(
      (tasksRoute as unknown as { reorder: { post: Mock } }).reorder.post
    );
    reorderPost.mockResolvedValue({ data: {}, error: null });

    const manyTasks = [...mockTasks, { ...mockTasks[0], id: 'task-2', title: 'Task 2' }];

    renderWithProviders(<KanbanBoard board={mockBoard} tasks={manyTasks} />);

    const dndProps = (globalThis as unknown as { lastDndProps: DndProps }).lastDndProps;

    if (dndProps.onDragEnd) {
      await act(async () => {
        dndProps.onDragEnd!({
          active: { id: 'task-1', data: { current: { type: 'task' } } },
          over: { id: 'task-2', data: { current: { type: 'task' } } }
        } as unknown as DragEndEvent);
      });
    }

    expect(reorderPost).toHaveBeenCalledWith(
      expect.objectContaining({
        columnId: 'col-1',
        taskIds: ['task-2', 'task-1'] // Swapped
      })
    );
  });

  it('should handle task duplication', async () => {
    const user = userEvent.setup();
    const tasksRoute = getMockRoute(mockApi.api.tasks);
    tasksRoute.post.mockResolvedValue({ data: { id: 'new-t' }, error: null });

    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);

    await user.click(screen.getByLabelText('Task actions'));

    const duplicateBtn = await screen.findByRole('menuitem', { name: /Duplicate/i });
    await user.click(duplicateBtn);

    expect(tasksRoute.post).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Task 1 (Copy)'
      })
    );
  });
});
