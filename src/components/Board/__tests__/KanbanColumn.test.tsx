import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KanbanColumn } from '../KanbanColumn';

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}));

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  SortableContext: ({ children }: any) => <div>{children}</div>,
  verticalListSortingStrategy: {},
}));

// Mock useDialogs
const mockAlert = vi.fn();
const mockConfirm = vi.fn();
vi.mock('../../../utils/useDialogs', () => ({
  useDialogs: () => ({
    alert: mockAlert,
    confirm: mockConfirm,
  }),
}));

describe('KanbanColumn', () => {
  const mockColumn = { id: 'col-1', name: 'To Do', position: 0, wipLimit: 5 };
  const mockTasks = [
    { id: 't1', title: 'Task 1', columnId: 'col-1' },
  ];

  const mockHandlers = {
    onAddTask: vi.fn(),
    onEditTask: vi.fn(),
    onDeleteTask: vi.fn(),
    getPriorityColor: vi.fn(() => 'blue'),
    onRenameColumn: vi.fn(),
    onDeleteColumn: vi.fn(),
    onUpdateWipLimit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render column header and tasks', () => {
    render(
      <KanbanColumn 
        column={mockColumn as any} 
        tasks={mockTasks as any} 
        boardId="b1"
        {...mockHandlers}
      />
    );

    expect(screen.getByText(/To Do/i)).toBeInTheDocument();
    expect(screen.getByText(/\(1\/5\)/)).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
  });

  it('should show WIP limit warning when exceeded', () => {
    const overloadedTasks = Array(6).fill({ id: 't', title: 'Task' });
    render(
      <KanbanColumn 
        column={mockColumn as any} 
        tasks={overloadedTasks as any} 
        boardId="b1"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Over WIP')).toBeInTheDocument();
  });

  it('should call onAddTask when plus button is clicked', () => {
    render(
      <KanbanColumn 
        column={mockColumn as any} 
        tasks={mockTasks as any} 
        boardId="b1"
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByLabelText('Add task'));
    expect(mockHandlers.onAddTask).toHaveBeenCalled();
  });

  it('should open edit dialog and handle column update', async () => {
    render(
      <KanbanColumn 
        column={mockColumn as any} 
        tasks={mockTasks as any} 
        boardId="b1"
        {...mockHandlers}
      />
    );

    // Open menu
    fireEvent.click(screen.getByLabelText('Column options'));
    
    // Click Edit Column (the menu item)
    const editBtns = await screen.findAllByText('Edit Column');
    fireEvent.click(editBtns[0]);

    const dialog = await screen.findByRole('dialog');
    // The dialog title is also "Edit Column"
    expect(within(dialog).getAllByText('Edit Column').length).toBeGreaterThan(0);

    const nameInput = within(dialog).getByPlaceholderText('Enter column name');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });

    const limitInput = within(dialog).getByPlaceholderText('Leave empty for no limit');
    fireEvent.change(limitInput, { target: { value: '10' } });

    fireEvent.click(within(dialog).getByText('Save Changes'));

    expect(mockHandlers.onRenameColumn).toHaveBeenCalledWith('col-1', 'New Name');
    expect(mockHandlers.onUpdateWipLimit).toHaveBeenCalledWith('col-1', 10);
  });

  it('should prevent deletion if tasks are present', async () => {
    render(
      <KanbanColumn 
        column={mockColumn as any} 
        tasks={mockTasks as any} 
        boardId="b1"
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByLabelText('Column options'));
    fireEvent.click(await screen.findByText('Delete Column'));

    expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Cannot Delete Column'
    }));
    expect(mockHandlers.onDeleteColumn).not.toHaveBeenCalled();
  });

  it('should call onDeleteColumn when empty and confirmed', async () => {
    mockConfirm.mockResolvedValue(true);
    render(
      <KanbanColumn 
        column={mockColumn as any} 
        tasks={[]} 
        boardId="b1"
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByLabelText('Column options'));
    fireEvent.click(await screen.findByText('Delete Column'));

    await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalled();
        expect(mockHandlers.onDeleteColumn).toHaveBeenCalledWith('col-1');
    });
  });
});
