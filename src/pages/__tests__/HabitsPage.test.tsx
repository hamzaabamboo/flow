import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import HabitsPage from '../habits/+Page';

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
const mockHabitsGet = vi.fn();
const mockHabitsStatsGet = vi.fn();
const mockHabitsPost = vi.fn();
const mockHabitsPatch = vi.fn();

vi.mock('../../api/client', () => ({
  api: {
    api: {
      habits: Object.assign(
        (params: any) => ({
          patch: (...args: any[]) => mockHabitsPatch(params, ...args),
          delete: { delete: vi.fn().mockResolvedValue({ data: { success: true } }) },
          stats: { get: (...args: any[]) => mockHabitsStatsGet(params, ...args) },
          log: { post: vi.fn() }
        }),
        {
          get: (...args: any[]) => mockHabitsGet(...args),
          post: (...args: any[]) => mockHabitsPost(...args)
        }
      )
    }
  }
}));

// Mock Dialogs (Headless UI or Radix Dialogs used in HabitsPage are complex to render fully in JSDOM sometimes)
// But `HabitsPage` uses `../../components/ui/styled/dialog` which exports Radix primitives.
// We can test them or mock them. Let's try testing real interactions first as we did with TaskDialog.
// However, if it fails, we mock.

describe('HabitsPage Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });

    mockHabitsGet.mockResolvedValue({ data: [], error: null });
    mockHabitsStatsGet.mockResolvedValue({
      data: { totalCompletions: 5, completionRate: 50 },
      error: null
    });
    mockHabitsPost.mockResolvedValue({ data: { id: 'h1' }, error: null });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('should render empty state', async () => {
    render(<HabitsPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('No habits yet')).toBeInTheDocument();
    });
  });

  it('should render habits grid', async () => {
    const habitsData = [
      { id: 'h1', name: 'Exercise', frequency: 'daily', space: 'work', active: true }
    ];
    mockHabitsGet.mockResolvedValue({ data: habitsData, error: null });

    render(<HabitsPage />, { wrapper });

    // Wait for loading to finish and data to appear
    await waitFor(() => {
      // Check if it's called
      expect(mockHabitsGet).toHaveBeenCalled();
    });
    expect(screen.getAllByText('Daily').length).toBeGreaterThan(0);
  });

  it('should open Create Habit dialog and submit', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<HabitsPage />, { wrapper });

    // Click New Habit
    const newBtn = screen.getByText('New Habit'); // in Header or Empty State
    await user.click(newBtn);

    // Dialog opens
    const dialog = await screen.findByRole('dialog');
    const nameInput = within(dialog).getByLabelText(/Name/i);

    await user.type(nameInput, 'Meditate');

    const createSubmit = within(dialog).getByText('Create');
    await user.click(createSubmit);

    await waitFor(() => {
      expect(mockHabitsPost).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Meditate',
          space: 'work'
        })
      );
    });
  });
});
