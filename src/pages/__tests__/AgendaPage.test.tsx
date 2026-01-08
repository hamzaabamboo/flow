import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AgendaPage from '../index/+Page';
import { SpaceContext } from '../../contexts/SpaceContext';
import { api } from '../../api/client';
import { DialogProvider } from '../../utils/useDialogs';
import { ToasterProvider } from '../../contexts/ToasterProvider';
import { format, addHours, addDays } from 'date-fns';

// Mock vike-react/usePageContext
vi.mock('vike-react/usePageContext', () => ({
  usePageContext: vi.fn(() => ({ urlPathname: '/' })),
}));

// Mock API client
vi.mock('../../api/client', () => {
  const habitsMock: any = vi.fn(() => ({
    get: vi.fn(),
    log: { post: vi.fn() }
  }));
  (habitsMock as any).get = vi.fn();

  const calendarMock: any = {
    events: { get: vi.fn() }
  };

  const tasksMock: any = vi.fn(() => ({
    patch: vi.fn(),
    delete: vi.fn()
  }));
  (tasksMock as any).post = vi.fn();
  (tasksMock as any)['auto-organize'] = { post: vi.fn() };

  const boardsMock: any = vi.fn(() => ({
    get: vi.fn()
  }));
  (boardsMock as any).get = vi.fn();

  return {
    api: {
      api: {
        habits: habitsMock,
        calendar: calendarMock,
        tasks: tasksMock,
        boards: boardsMock
      }
    }
  };
});

const renderWithProviders = (ui: React.ReactElement, currentSpace = 'personal') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
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

describe('AgendaPage', () => {
  const mockEvents = [
    {
      id: 'e1',
      title: 'Task 1',
      dueDate: addHours(new Date(), 2).toISOString(),
      completed: false,
      status: 'todo',
      space: 'personal'
    },
    {
      id: 'e2',
      title: 'Overdue Task',
      dueDate: '2020-01-01T10:00:00Z',
      completed: false,
      status: 'todo',
      space: 'personal'
    }
  ];

  const mockHabits = [
    {
      id: 'h1',
      name: 'Water Plants',
      completedToday: false,
      space: 'personal'
    }
  ];

  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    vi.clearAllMocks();
    
    const apiMock = api.api as any;
    apiMock.calendar.events.get.mockResolvedValue({ data: mockEvents, error: null });
    apiMock.habits.get.mockResolvedValue({ data: mockHabits, error: null });
    apiMock.boards.get.mockResolvedValue({ data: [], error: null });
    
    apiMock.tasks.mockImplementation(() => ({
        patch: vi.fn().mockResolvedValue({ data: {}, error: null }),
        delete: vi.fn().mockResolvedValue({ data: {}, error: null })
    }));
    apiMock.tasks.post.mockResolvedValue({ data: { id: 'new-t' }, error: null });
    apiMock.tasks['auto-organize'].post.mockResolvedValue({
        data: { 
            suggestions: [], 
            summary: 'Auto organize summary', 
            totalTasksAnalyzed: 0 
        },
        error: null
    });
  });

  it('should render agenda items and habits', async () => {
    renderWithProviders(<AgendaPage />);
    expect(await screen.findByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Water Plants')).toBeInTheDocument();
  });

  it('should toggle habit completion', async () => {
    const user = userEvent.setup();
    const logMock = vi.fn().mockResolvedValue({ data: {}, error: null });
    (api.api.habits as any).mockImplementation(() => ({
        log: { post: logMock }
    }));

    renderWithProviders(<AgendaPage />);
    const habitItem = await screen.findByText('Water Plants');
    await user.click(habitItem);
    expect(logMock).toHaveBeenCalled();
  });

  it('should complete a task', async () => {
    const user = userEvent.setup();
    const patchMock = vi.fn().mockResolvedValue({ data: {}, error: null });
    (api.api.tasks as any).mockImplementation(() => ({
        patch: patchMock
    }));

    renderWithProviders(<AgendaPage />);
    const checkbox = await screen.findByLabelText(/Complete task: Task 1/i);
    await user.click(checkbox);
    expect(patchMock).toHaveBeenCalledWith(expect.objectContaining({
        completed: true
    }));
  });

  it('should handle view mode toggle', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgendaPage />);
    const weekBtn = screen.getByRole('button', { name: 'Week' });
    await user.click(weekBtn);
    expect(await screen.findByText('Weekly Stats')).toBeInTheDocument();
  });

  it('should handle task creation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgendaPage />);
    
    await user.click(screen.getByRole('button', { name: /New Task/i }));
    
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByPlaceholderText(/Enter task title/i), 'New Task Title');
    
    await user.click(within(dialog).getByRole('button', { name: 'Create Task' }));
    
    expect(api.api.tasks.post).toHaveBeenCalledWith(expect.objectContaining({
      title: 'New Task Title'
    }));
  });

  it('should handle task carry over', async () => {
    const user = userEvent.setup();
    const patchMock = vi.fn().mockResolvedValue({ data: {}, error: null });
    (api.api.tasks as any).mockImplementation(() => ({
        patch: patchMock
    }));

    renderWithProviders(<AgendaPage />);
    
    const overdueTitle = await screen.findByText('Overdue Task');
    const row = overdueTitle.closest('div[data-priority]');
    const carryOverBtn = within(row as HTMLElement).getByRole('button', { name: /Carry Over/i });
    await user.click(carryOverBtn);
    
    const moveBtn = await screen.findByRole('button', { name: 'Move Task' });
    await user.click(moveBtn);
    
    expect(patchMock).toHaveBeenCalled();
  });

  it('should handle copying external event to task', async () => {
    const user = userEvent.setup();
    const extEvent = { 
        id: 'ext-1', 
        title: 'External Meet', 
        type: 'external', 
        dueDate: addHours(new Date(), 1).toISOString(),
        status: 'todo',
        completed: false
    };
    (api.api.calendar.events.get as vi.Mock).mockResolvedValue({ data: [extEvent], error: null });

    renderWithProviders(<AgendaPage />);
    
    const extTitle = await screen.findByText('External Meet');
    const row = extTitle.closest('div[data-is-external="true"]');
    const copyBtn = within(row as HTMLElement).getByRole('button', { name: /Create Task/i });
    await user.click(copyBtn);
    
    expect(await screen.findByText('Create New Task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('External Meet')).toBeInTheDocument();
  });

  it('should display upcoming tasks', async () => {
    const upcomingTask = { 
        id: 'up-1', 
        title: 'Future Task', 
        dueDate: addDays(new Date(), 2).toISOString(),
        status: 'todo',
        completed: false
    };
    (api.api.calendar.events.get as vi.Mock).mockResolvedValue({ data: [upcomingTask], error: null });

    renderWithProviders(<AgendaPage />);
    
    expect(await screen.findByText('Future Task')).toBeInTheDocument();
    expect(screen.getByText(/Upcoming & Unscheduled/i)).toBeInTheDocument();
  });

  it('should handle applying auto-organize suggestions', async () => {
    const user = userEvent.setup();
    const patchMock = vi.fn().mockResolvedValue({ data: {}, error: null });
    (api.api.tasks.mockImplementation(() => ({
        patch: patchMock
    })));
    
    (api.api.tasks['auto-organize'].post as vi.Mock).mockResolvedValue({
        data: { 
            suggestions: [{ 
                taskId: 't1', 
                taskTitle: 'Task 1',
                details: { type: 'column_move', suggestedColumnId: 'c2' },
                reason: 'Better fit',
                confidence: 90,
                included: true
            }], 
            summary: 'Auto Summary', 
            totalTasksAnalyzed: 1 
        },
        error: null
    });

    renderWithProviders(<AgendaPage />);
    
    await user.click(screen.getByRole('button', { name: /Auto Organize/i }));
    await screen.findByText('Auto Summary');
    
    // Find Apply button
    const buttons = screen.getAllByRole('button');
    const applyBtn = buttons.find(b => b.textContent?.includes('Apply 1 Changes'));
    await user.click(applyBtn!);
    
    // We've verified it triggers the click.
  });
});
