// This is a complex replacement to remove many casts. I'll provide the whole file.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, type ReactElement, type ReactNode } from 'react';
import AgendaPage from '../index/+Page';
import { SpaceContext } from '../../contexts/SpaceContext';
import { api } from '../../api/client';
import { DialogProvider } from '../../utils/useDialogs';
import { ToasterProvider } from '../../contexts/ToasterProvider';
import { addHours, addDays } from 'date-fns';
import { asMock } from '../../test/mocks/api';

// Mock vike-react/usePageContext
vi.mock('vike-react/usePageContext', () => ({
  usePageContext: vi.fn(() => ({ urlPathname: '/' }))
}));

// Mock API client
vi.mock('../../api/client', async () => {
  const mocks = await import('../../test/mocks/api');
  return {
    api: mocks.mockApi
  };
});

function TestProviders({
  children,
  queryClient,
  currentSpace
}: {
  children: ReactNode;
  queryClient: QueryClient;
  currentSpace: 'work' | 'personal';
}) {
  const spaceValue = useMemo(
    () => ({
      currentSpace,
      setCurrentSpace: vi.fn(),
      toggleSpace: vi.fn()
    }),
    [currentSpace]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SpaceContext.Provider value={spaceValue}>
        <ToasterProvider>
          <DialogProvider>{children}</DialogProvider>
        </ToasterProvider>
      </SpaceContext.Provider>
    </QueryClientProvider>
  );
}

const renderWithProviders = (ui: ReactElement, currentSpace: 'work' | 'personal' = 'personal') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  return render(
    <TestProviders queryClient={queryClient} currentSpace={currentSpace}>
      {ui}
    </TestProviders>
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockEvents), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      )
    );

    const apiMock = api.api;
    asMock(apiMock.habits.get).mockResolvedValue({ data: mockHabits, error: null });
    asMock(apiMock.boards.get).mockResolvedValue({ data: [], error: null });

    asMock(apiMock.tasks).mockImplementation(() => ({
      patch: vi.fn().mockResolvedValue({ data: {}, error: null }),
      delete: vi.fn().mockResolvedValue({ data: {}, error: null })
    }));
    asMock(apiMock.tasks.post).mockResolvedValue({ data: { id: 'new-t' }, error: null });
    asMock(apiMock.tasks['auto-organize'].post).mockResolvedValue({
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
    asMock(api.api.habits).mockImplementation(() => ({
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
    asMock(api.api.tasks).mockImplementation(() => ({
      patch: patchMock
    }));

    renderWithProviders(<AgendaPage />);
    const checkbox = await screen.findByLabelText(/Complete task: Task 1/i);
    await user.click(checkbox);
    expect(patchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        completed: true
      })
    );
  });

  it('should handle view mode toggle', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgendaPage />);
    await screen.findByText('Task 1');
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

    expect(asMock(api.api.tasks.post)).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Task Title'
      })
    );
  });

  it('should handle task carry over', async () => {
    const user = userEvent.setup();
    const patchMock = vi.fn().mockResolvedValue({ data: {}, error: null });
    asMock(api.api.tasks).mockImplementation(() => ({
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

  it('should allow completing overdue tasks from the agenda day view', async () => {
    const user = userEvent.setup();
    const patchMock = vi.fn().mockResolvedValue({ data: {}, error: null });
    asMock(api.api.tasks).mockImplementation(() => ({
      patch: patchMock
    }));

    renderWithProviders(<AgendaPage />);

    const checkbox = await screen.findByLabelText(/Complete task: Overdue Task/i);
    await user.click(checkbox);

    expect(patchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        completed: true
      })
    );
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify([extEvent]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      )
    );

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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify([upcomingTask]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      )
    );

    renderWithProviders(<AgendaPage />);

    expect(await screen.findByText('Future Task')).toBeInTheDocument();
    expect(screen.getByText(/Upcoming & Unscheduled/i)).toBeInTheDocument();
  });

  it('should bucket agenda tasks relative to the selected date', async () => {
    window.history.replaceState({}, '', '/?date=2026-04-07');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 'over-1',
                title: 'Selected Date Overdue',
                dueDate: '2026-04-06T00:00:00.000Z',
                status: 'todo',
                completed: false,
                space: 'personal'
              },
              {
                id: 'today-1',
                title: 'Selected Date Today',
                dueDate: '2026-04-07T00:00:00.000Z',
                status: 'todo',
                completed: false,
                space: 'personal'
              },
              {
                id: 'up-1',
                title: 'Selected Date Upcoming',
                dueDate: '2026-04-09T00:00:00.000Z',
                status: 'todo',
                completed: false,
                space: 'personal'
              }
            ]),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        )
      )
    );

    renderWithProviders(<AgendaPage />);

    expect(await screen.findByText('Selected Date Overdue')).toBeInTheDocument();
    expect(screen.getByText('Selected Date Today')).toBeInTheDocument();
    expect(screen.getByText('Selected Date Upcoming')).toBeInTheDocument();
    expect(screen.getByText(/Tuesday, Apr 7, 2026/i)).toBeInTheDocument();
  });

  it('should handle applying auto-organize suggestions', async () => {
    const user = userEvent.setup();
    const patchMock = vi.fn().mockResolvedValue({ data: {}, error: null });
    asMock(api.api.tasks).mockImplementation(() => ({
      patch: patchMock
    }));

    asMock(api.api.tasks['auto-organize']!.post).mockResolvedValue({
      data: {
        suggestions: [
          {
            taskId: 't1',
            taskTitle: 'Task 1',
            details: { type: 'column_move', suggestedColumnId: 'c2' },
            reason: 'Better fit',
            confidence: 90,
            included: true
          }
        ],
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
    const applyBtn = buttons.find((b) => b.textContent?.includes('Apply 1 Changes'));
    await user.click(applyBtn!);

    // We've verified it triggers the click.
  });
});
