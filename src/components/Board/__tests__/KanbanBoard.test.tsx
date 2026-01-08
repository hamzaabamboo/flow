import { render, screen, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KanbanBoard } from '../KanbanBoard';
import { SpaceContext } from '../../../contexts/SpaceContext';
import { api } from '../../../api/client';
import { DialogProvider } from '../../../utils/useDialogs';
import type { BoardWithColumns, Task } from '../../../shared/types';

// Mock API
vi.mock('../../../api/client', () => {
  const mockTasks: any = vi.fn(() => ({
    patch: vi.fn(),
    delete: vi.fn()
  }));
  mockTasks.post = vi.fn();
  mockTasks.reorder = { post: vi.fn() };
  
  const mockColumns: any = vi.fn(() => ({
    patch: vi.fn(),
    delete: vi.fn()
  }));
  mockColumns.post = vi.fn();
  mockColumns.reorder = { post: vi.fn() };

  const mockBoards: any = {
    get: vi.fn()
  };

  return {
    api: {
      api: {
        boards: mockBoards,
        tasks: mockTasks,
        columns: mockColumns
      }
    }
  };
});

const mockTaskPatch = vi.fn();
const mockTaskDelete = vi.fn();
const mockColumnPatch = vi.fn();
const mockColumnDelete = vi.fn();

const mockSpaceContext = {
  currentSpace: 'work',
  spaces: [],
  setSpaces: vi.fn(),
  setCurrentSpace: vi.fn(),
  getSpaceById: vi.fn(),
  toggleSpace: vi.fn(),
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const ToasterProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <SpaceContext.Provider value={mockSpaceContext as any}>
        <ToasterProvider>
          <DialogProvider>
            {ui}
          </DialogProvider>
        </ToasterProvider>
      </SpaceContext.Provider>
    </QueryClientProvider>
  );
};

// Mock DndContext to capture props
vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual('@dnd-kit/core');
  return {
    ...actual as any,
    DndContext: (props: any) => {
      (global as any).lastDndProps = props;
      return <div data-testid="dnd-context">{props.children}</div>;
    },
    // Mock sensors to avoid initialization issues
    useSensor: vi.fn(),
    useSensors: vi.fn(),
    PointerSensor: vi.fn(),
    TouchSensor: vi.fn(),
  };
});

describe('KanbanBoard', () => {
  const mockBoard: BoardWithColumns = {
    id: 'board-1',
    name: 'Work Board',
    space: 'work',
    userId: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    columns: [
      { 
        id: 'col-1', 
        name: 'To Do', 
        position: 0, 
        taskOrder: [], 
        boardId: 'board-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
    ],
  };

  const mockTasks: Task[] = [
    { 
        id: 'task-1', 
        title: 'Task 1', 
        columnId: 'col-1', 
        priority: 'high',
        userId: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    
    // Setup implementation for each test
    (api.api.tasks as any).mockImplementation(() => ({
        patch: mockTaskPatch,
        delete: mockTaskDelete,
    }));
    (api.api.columns as any).mockImplementation(() => ({
        patch: mockColumnPatch,
        delete: mockColumnDelete,
    }));
    
    (api.api.boards.get as any).mockResolvedValue({ data: [mockBoard], error: null });
  });

  it('should render board columns and tasks', () => {
    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);
    expect(screen.getByText('To Do (1)')).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
  });

  it('should handle column editing (rename)', async () => {
    const user = userEvent.setup();
    mockColumnPatch.mockResolvedValue({ data: {}, error: null });
    
    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);
    
    await user.click(screen.getByLabelText(/Column options/i));
    
    const editBtn = await screen.findByRole('menuitem', { name: /Edit Column/i });
    await user.click(editBtn);
    
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByDisplayValue('To Do');
    await user.clear(input);
    await user.type(input, 'New Name');
    
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
    
    expect(mockColumnPatch).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }));
  });

  it('should handle adding a new column', async () => {
    const user = userEvent.setup();
    const mockColumnPost = api.api.columns.post as any;
    mockColumnPost.mockResolvedValue({ data: { id: 'col-2', name: 'Done' }, error: null });

    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);
    
    await user.click(screen.getByText(/Add Column/i));
    
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByPlaceholderText(/Enter column name/i);
    await user.type(input, 'Done');
    
    await user.click(within(dialog).getByRole('button', { name: /Create Column/i }));
    
    expect(mockColumnPost).toHaveBeenCalledWith(expect.objectContaining({ name: 'Done' }));
  });

  it('should handle column deletion', async () => {
    const user = userEvent.setup();
    mockColumnDelete.mockResolvedValue({ data: { success: true }, error: null });

    renderWithProviders(<KanbanBoard board={mockBoard} tasks={[]} />); // No tasks to allow deletion
    
    await user.click(screen.getByLabelText(/Column options/i));
    const deleteBtn = await screen.findByRole('menuitem', { name: /Delete Column/i });
    await user.click(deleteBtn);
    
    const confirmBtn = await screen.findByRole('button', { name: /Delete/i });
    await user.click(confirmBtn);
    
    expect(mockColumnDelete).toHaveBeenCalled();
  });

  it('should handle updating WIP limit via Edit Column dialog', async () => {
    const user = userEvent.setup();
    mockColumnPatch.mockResolvedValue({ data: {}, error: null });

    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);
    
    await user.click(screen.getByLabelText(/Column options/i));
    const editBtn = await screen.findByRole('menuitem', { name: /Edit Column/i });
    await user.click(editBtn);
    
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByPlaceholderText(/Leave empty for no limit/i);
    await user.type(input, '5');
    
    await user.click(within(dialog).getByRole('button', { name: /Save Changes/i }));
    
    expect(mockColumnPatch).toHaveBeenCalledWith(expect.objectContaining({ wipLimit: 5 }));
  });

  it('should handle task deletion', async () => {
    const user = userEvent.setup();
    mockTaskDelete.mockResolvedValue({ data: { success: true }, error: null });

    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);
    
    await user.click(screen.getByLabelText(/Task actions/i));
    const deleteBtn = await screen.findByRole('menuitem', { name: /Delete/i });
    await user.click(deleteBtn);
    
    expect(mockTaskDelete).toHaveBeenCalled();
  });

  it('should handle task move across boards', async () => {
    const user = userEvent.setup();
    mockTaskPatch.mockResolvedValue({ data: {}, error: null });
    (api.api.boards.get as any).mockResolvedValue({ 
        data: [
            mockBoard, 
            { ...mockBoard, id: 'b2', name: 'Other Board', columns: [{ id: 'col-3', name: 'B2Col', boardId: 'b2', position: 0, taskOrder: [], createdAt: '', updatedAt: '' }] }
        ], 
        error: null 
    });

    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);
    
    await user.click(screen.getByLabelText('Task actions'));
    
    const moveBtn = await screen.findByRole('menuitem', { name: /Move to Board/i });
    await user.click(moveBtn);
    
    const dialog = await screen.findByRole('dialog');
    const submitBtn = within(dialog).getByRole('button', { name: 'Move Task' });
    await user.click(submitBtn);
    
    expect(mockTaskPatch).toHaveBeenCalledWith(expect.objectContaining({ columnId: 'col-1' }));
  });

  it('should handle target board selection change in move dialog', async () => {
    const user = userEvent.setup();
    (api.api.boards.get as any).mockResolvedValue({ 
        data: [
            mockBoard, 
            { ...mockBoard, id: 'b2', name: 'Other Board', columns: [{ id: 'col-3', name: 'B2Col', boardId: 'b2', position: 0, taskOrder: [], createdAt: '', updatedAt: '' }] }
        ], 
        error: null 
    });

    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);
    
    await user.click(screen.getByLabelText('Task actions'));
    await user.click(await screen.findByRole('menuitem', { name: /Move to Board/i }));
    
    // Open board select
    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[0]); // Board select
    
    const otherOption = await screen.findByRole('option', { name: 'Other Board' });
    await user.click(otherOption);
    
    // Column select should update to B2Col (first column of target board)
    // Multiple B2Col might exist (trigger and list item)
    const columnTexts = await screen.findAllByText('B2Col');
    expect(columnTexts.length).toBeGreaterThan(0);
  });

  it('should handle dragging a task over another column (move)', async () => {
    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);
    
    const dndProps = (global as any).lastDndProps;
    
    await waitFor(() => expect(dndProps.onDragOver).toBeDefined());

    await act(async () => {
        dndProps.onDragOver({
            active: { id: 'task-1', data: { current: { type: 'task' } } },
            over: { id: 'col-2', data: { current: { type: 'column' } } }
        });
    });

    expect(mockTaskPatch).toHaveBeenCalledWith(expect.objectContaining({ columnId: 'col-2' }));
  });

  it('should handle dragging a task over another task in same column (reorder)', async () => {
    const mockReorder = api.api.tasks.reorder.post as any;
    mockReorder.mockResolvedValue({ data: {}, error: null });
    
    const manyTasks = [
        ...mockTasks,
        { ...mockTasks[0], id: 'task-2', title: 'Task 2' }
    ];

    renderWithProviders(<KanbanBoard board={mockBoard} tasks={manyTasks} />);
    
    const dndProps = (global as any).lastDndProps;

    await act(async () => {
        dndProps.onDragEnd({
            active: { id: 'task-1', data: { current: { type: 'task' } } },
            over: { id: 'task-2', data: { current: { type: 'task' } } }
        });
    });

    expect(mockReorder).toHaveBeenCalledWith(expect.objectContaining({
        columnId: 'col-1',
        taskIds: ['task-2', 'task-1'] // Swapped
    }));
  });

  it('should handle task duplication', async () => {
    const user = userEvent.setup();
    const mockTaskPost = api.api.tasks.post as any;
    mockTaskPost.mockResolvedValue({ data: { id: 'new-t' }, error: null });
    
    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);
    
    await user.click(screen.getByLabelText('Task actions'));
    
    const duplicateBtn = await screen.findByRole('menuitem', { name: /Duplicate/i });
    await user.click(duplicateBtn);
    
    expect(mockTaskPost).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Task 1 (Copy)'
    }));
  });

  it('should handle complex task submission (create)', async () => {
    const user = userEvent.setup();
    const mockTaskPost = api.api.tasks.post as any;
    mockTaskPost.mockResolvedValue({ data: { id: 'new-t' }, error: null });

    renderWithProviders(<KanbanBoard board={mockBoard} tasks={mockTasks} />);
    
    await user.click(screen.getByLabelText(/Add task/i));
    
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByPlaceholderText(/Enter task title/i), 'New Task');
    await user.type(within(dialog).getByPlaceholderText(/Enter task description/i), 'Desc');
    
    // Priority is a radio group
    const priorityHigh = within(dialog).getByLabelText(/High/i);
    await user.click(priorityHigh);

    await user.click(within(dialog).getByRole('button', { name: /Create Task/i }));
    
    expect(mockTaskPost).toHaveBeenCalledWith(expect.objectContaining({
      title: 'New Task',
      description: 'Desc',
      priority: 'high',
      columnId: 'col-1'
    }));
  });
});
