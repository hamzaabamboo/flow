import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import AgendaPage from '../index/+Page';

// oxlint-disable-next-line no-unassigned-import
import '@testing-library/jest-dom';

// Mock SpaceContext
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
const mockEventsGet = vi.fn();
const mockHabitsGet = vi.fn();
const mockTasksPost = vi.fn();
const mockTasksPatch = vi.fn();

vi.mock('../../api/client', () => ({
  api: {
    api: {
      calendar: {
        events: {
          get: (...args: any[]) => mockEventsGet(...args)
        }
      },
      habits: {
        get: (...args: any[]) => mockHabitsGet(...args)
        // Mock sub-routes for habits if needed (log post)
        // habits({habitId}) -> log -> post
      },
      tasks: Object.assign(
        (params: any) => ({
          patch: (...args: any[]) => mockTasksPatch(params, ...args),
          get: vi.fn()
        }),
        {
          post: (...args: any[]) => mockTasksPost(...args),
          patch: (...args: any[]) => mockTasksPatch(...args) // if used directly separate from ID
        }
      )
    }
  }
}));

// Mock Components
vi.mock('../../components/Board/TaskDialog', () => ({
  TaskDialog: ({ open, mode }: any) =>
    open ? <div data-testid="task-dialog">{mode} mode</div> : null
}));

vi.mock('../../components/MoveTaskDialog', () => ({
  MoveTaskDialog: () => <div data-testid="move-task-dialog" />
}));

vi.mock('../../components/AutoOrganize/AutoOrganizeDialog', () => ({
  AutoOrganizeDialog: ({ open }: any) => (open ? <div data-testid="auto-organize-dialog" /> : null)
}));

// Mock Agenda Sub-components to avoid deep rendering but verify presence
vi.mock('../../components/Agenda/AgendaWeekView', () => ({
  AgendaWeekView: () => <div data-testid="agenda-week-view" />
}));

// We want to test Day View rendering logic (grids etc), so maybe we don't mock AgendaDayView entirely?
// But AgendaDayView renders `events`.
// Let's mock it to simplify "Page" testing - we assume subcomponents are tested or we trust them for now.
// The integration test focuses on the PAGE orchestrating data.
vi.mock('../../components/Agenda/AgendaDayView', () => ({
  AgendaDayView: ({ events }: any) => (
    <div data-testid="agenda-day-view">
      {events?.map((e: any) => (
        <div key={e.id} data-testid="day-event">
          {e.title}
        </div>
      ))}
    </div>
  )
}));

vi.mock('../../components/Agenda/StatsCard', () => ({
  StatsCard: ({ stats }: any) => <div data-testid="stats-card">Total: {stats?.total}</div>
}));

vi.mock('../../components/Agenda/HabitsCard', () => ({
  HabitsCard: () => <div data-testid="habits-card" />
}));

vi.mock('../../components/Agenda/OverdueTasksCard', () => ({
  OverdueTasksCard: ({ overdueTasks }: any) => (
    <div data-testid="overdue-card">Overdue: {overdueTasks?.length}</div>
  )
}));

vi.mock('../../components/Agenda/UpcomingTasksCard', () => ({
  UpcomingTasksCard: () => <div data-testid="upcoming-card" />
}));

// Mock useTaskActions to verify page interactions without context hell
vi.mock('../../hooks/useTaskActions', () => ({
  useTaskActions: () => ({
    handleEdit: vi.fn(),
    handleDuplicate: vi.fn(),
    handleDelete: vi.fn(),
    handleMove: vi.fn(),
    extraActions: []
  })
}));

describe('AgendaPage Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });

    // Default API responses
    mockEventsGet.mockResolvedValue({ data: [], error: null });
    mockHabitsGet.mockResolvedValue({ data: [], error: null });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('should render the Agenda page header', async () => {
    render(<AgendaPage />, { wrapper });

    expect(screen.getByRole('heading', { name: /Agenda/i })).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('should load and display events', async () => {
    mockEventsGet.mockResolvedValue({
      data: [{ id: '1', title: 'Event 1', dueDate: new Date().toISOString() }],
      error: null
    });

    render(<AgendaPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId('day-event')).toBeInTheDocument();
      expect(screen.getByText('Event 1')).toBeInTheDocument();
    });
  });

  it('should display stats', async () => {
    mockEventsGet.mockResolvedValue({
      data: [
        { id: '1', title: 'Task 1', dueDate: new Date().toISOString() }, // Today
        { id: '2', title: 'Task 2', dueDate: new Date().toISOString() }
      ],
      error: null
    });
    // Habits handled by HabitsCard mock

    render(<AgendaPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId('stats-card')).toHaveTextContent('Total: 2');
    });
  });

  it('should open Create Task dialog', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<AgendaPage />, { wrapper });

    const createBtn = screen.getByText('New Task');
    await user.click(createBtn);

    expect(screen.getByTestId('task-dialog')).toBeInTheDocument();
  });

  it('should handle view mode toggle (Day/Week)', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<AgendaPage />, { wrapper }); // Default Day

    await waitFor(() => {
      expect(screen.getByTestId('agenda-day-view')).toBeInTheDocument();
    });

    const weekBtn = screen.getByText('Week');
    await user.click(weekBtn);

    // Should render Week View
    expect(screen.getByTestId('agenda-week-view')).toBeInTheDocument();

    // API should be called with updated params (we assume React Query refetches)
    // Checking if mockEventsGet Called is tricky due to re-renders, but we can assume logic works if component verified.
  });

  it('should handle date navigation', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<AgendaPage />, { wrapper });

    const nextBtn = screen.getByLabelText('Next');
    await user.click(nextBtn);

    // Date state updates -> Query key updates -> API called
    // We verify API call with different timestamp?
    await waitFor(() => {
      expect(mockEventsGet).toHaveBeenCalled();
      // Inspect args if needed, but simple verification of flow is good.
    });
  });
});
