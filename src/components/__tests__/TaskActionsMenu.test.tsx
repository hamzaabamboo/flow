import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskActionsMenu } from '../TaskActionsMenu';
import type { Task, CalendarEvent } from '../../shared/types';

describe('TaskActionsMenu', () => {
  const mockTask = { id: 'task-1', title: 'Test Task' };
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onDuplicate = vi.fn();
  const onMove = vi.fn();

  it('should render trigger button', () => {
    render(<TaskActionsMenu task={mockTask as unknown as Task} onEdit={onEdit} />);
    expect(screen.getByLabelText('Task actions')).toBeInTheDocument();
  });

  it('should open menu and show actions when clicked', async () => {
    render(
      <TaskActionsMenu
        task={mockTask as unknown as Task}
        onEdit={onEdit}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onMove={onMove}
      />
    );

    fireEvent.click(screen.getByLabelText('Task actions'));

    expect(await screen.findByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
    expect(screen.getByText('Move to Board')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should call callbacks when actions are clicked', async () => {
    render(<TaskActionsMenu task={mockTask as unknown as Task} onEdit={onEdit} onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText('Task actions'));

    fireEvent.click(await screen.findByText('Edit'));
    expect(onEdit).toHaveBeenCalledWith(mockTask);

    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith(mockTask);
  });

  it('should render extra actions', async () => {
    const onExtra = vi.fn();
    const extraActions = [
      { value: 'extra', label: 'Extra Action', icon: <span />, onClick: onExtra }
    ];

    render(<TaskActionsMenu task={mockTask as unknown as Task} onEdit={onEdit} extraActions={extraActions} />);

    fireEvent.click(screen.getByLabelText('Task actions'));

    const extraBtn = await screen.findByText('Extra Action');
    fireEvent.click(extraBtn);
    expect(onExtra).toHaveBeenCalledWith(mockTask);
  });
});
