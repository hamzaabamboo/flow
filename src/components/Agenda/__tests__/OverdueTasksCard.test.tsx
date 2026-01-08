import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { OverdueTasksCard } from '../OverdueTasksCard';
import { DialogProvider } from '../../../utils/useDialogs';
import type { CalendarEvent } from '../../../shared/types/calendar';
import React from 'react';

describe('OverdueTasksCard', () => {
  const mockTasks: CalendarEvent[] = [
    { 
        id: '1', 
        title: 'Overdue 1', 
        dueDate: '2020-01-01T10:00:00Z',
        type: 'task',
        completed: false,
        instanceDate: '2020-01-01',
        space: 'work'
    },
    { 
        id: '2', 
        title: 'Overdue 2', 
        dueDate: '2020-01-01T08:00:00Z',
        type: 'task',
        completed: false,
        instanceDate: '2020-01-01',
        space: 'personal'
    },
  ];

  const mockHandlers = {
    onCarryOver: vi.fn(),
    onToggleComplete: vi.fn(),
    onTaskClick: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    onCreateCopy: vi.fn(),
  };

  const renderWithDialog = (ui: React.ReactElement) => {
    return render(
      <DialogProvider>
        {ui}
      </DialogProvider>
    );
  };

  it('should render list of overdue tasks', () => {
    renderWithDialog(<OverdueTasksCard overdueTasks={mockTasks} {...mockHandlers} />);

    expect(screen.getByText('Overdue Tasks')).toBeInTheDocument();
    expect(screen.getByText('2 tasks overdue')).toBeInTheDocument();
    expect(screen.getByText('Overdue 1')).toBeInTheDocument();
    expect(screen.getByText('Overdue 2')).toBeInTheDocument();
  });

  it('should call onCarryOver when "Carry Over All" is clicked and dialog confirmed', async () => {
    const user = userEvent.setup();
    renderWithDialog(<OverdueTasksCard overdueTasks={mockTasks} {...mockHandlers} />);

    const carryOverAllBtn = screen.getByRole('button', { name: /Carry Over All/i });
    await user.click(carryOverAllBtn);

    // Wait for CarryOverControls dialog
    const dialog = await screen.findByRole('dialog');
    const moveBtn = within(dialog).getByRole('button', { name: /Carry Over All/i });
    await user.click(moveBtn);

    // The component maps the original tasks array, so it follows the input order
    expect(mockHandlers.onCarryOver).toHaveBeenCalledWith(['1', '2'], expect.any(Date));
  });

  it('should call onCarryOver for a single task via Carry Over button', async () => {
    const user = userEvent.setup();
    renderWithDialog(<OverdueTasksCard overdueTasks={[mockTasks[0]]} {...mockHandlers} />);

    // Find the specific task item's Carry Over button
    // It's a button with text "Carry Over" (not "Carry Over All")
    const buttons = screen.getAllByRole('button', { name: /Carry Over/i });
    const carryOverBtn = buttons.find(b => b.textContent?.trim() === 'Carry Over');
    await user.click(carryOverBtn!);

    const dialog = await screen.findByRole('dialog');
    const moveBtn = within(dialog).getByRole('button', { name: /Move Task/i });
    await user.click(moveBtn);

    expect(mockHandlers.onCarryOver).toHaveBeenCalledWith(['1'], expect.any(Date));
  });

  it('should return null when no overdue tasks', () => {
    const { container } = renderWithDialog(<OverdueTasksCard overdueTasks={[]} {...mockHandlers} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render board and column names as badges', () => {
    const tasksWithBoard: CalendarEvent[] = [
      {
        ...mockTasks[0],
        boardName: 'Work Board',
        columnName: 'To Do'
      }
    ];

    renderWithDialog(<OverdueTasksCard overdueTasks={tasksWithBoard} {...mockHandlers} />);

    expect(screen.getByText('Work Board')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
  });

  it('should call callbacks for task actions', async () => {
    const user = userEvent.setup();
    renderWithDialog(<OverdueTasksCard overdueTasks={[mockTasks[0]]} {...mockHandlers} />);

    await user.click(screen.getByLabelText(/Task actions/i));
    
    await user.click(await screen.findByRole('menuitem', { name: /Duplicate/i }));
    expect(mockHandlers.onDuplicate).toHaveBeenCalled();

    await user.click(screen.getByLabelText(/Task actions/i));
    await user.click(await screen.findByRole('menuitem', { name: /Delete/i }));
    expect(mockHandlers.onDelete).toHaveBeenCalled();

    await user.click(screen.getByLabelText(/Task actions/i));
    await user.click(await screen.findByRole('menuitem', { name: /Move to Board/i }));
    expect(mockHandlers.onMove).toHaveBeenCalled();
  });

  it('should call onCreateCopy for external events', async () => {
    const user = userEvent.setup();
    const extTask: CalendarEvent = { 
        ...mockTasks[0], 
        type: 'external', 
        id: 'ext-1' 
    };
    renderWithDialog(<OverdueTasksCard overdueTasks={[extTask]} {...mockHandlers} />);

    await user.click(screen.getByRole('button', { name: /Create Task/i }));
    expect(mockHandlers.onCreateCopy).toHaveBeenCalled();
  });
});
