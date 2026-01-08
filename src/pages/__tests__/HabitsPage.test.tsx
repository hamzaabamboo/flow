import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HabitsPage from '../habits/+Page';
import { SpaceContext } from '../../contexts/SpaceContext';
import { api } from '../../api/client';

// Mock the API client
vi.mock('../../api/client', () => {
  const habitsMock: any = vi.fn(() => ({
    stats: { get: vi.fn().mockResolvedValue({ data: { totalCompletions: 0, completionRate: 0 }, error: null }) },
    patch: vi.fn().mockResolvedValue({ data: {}, error: null }),
    delete: vi.fn().mockResolvedValue({ data: {}, error: null }),
    log: { post: vi.fn().mockResolvedValue({ data: {}, error: null }) }
  }));
  habitsMock.get = vi.fn().mockResolvedValue({ data: [], error: null });
  habitsMock.post = vi.fn().mockResolvedValue({ data: { id: 'new' }, error: null });
  
  return {
    api: {
      api: {
        habits: habitsMock
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
        {ui}
      </SpaceContext.Provider>
    </QueryClientProvider>
  );
};

describe('HabitsPage', () => {
  const mockHabits = [
    {
      id: 'h1',
      name: 'Morning Run',
      description: 'Run 5km',
      frequency: 'daily',
      active: true,
      currentStreak: 5,
      space: 'personal',
      color: '#3b82f6',
    },
    {
      id: 'h2',
      name: 'Read Books',
      frequency: 'weekly',
      targetDays: [1, 3, 5],
      active: true,
      currentStreak: 2,
      space: 'personal',
    }
  ];

  const mockStats = [
    { habitId: 'h1', totalCompletions: 20, completionRate: 85 },
    { habitId: 'h2', totalCompletions: 10, completionRate: 60 }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    const habitsMock = api.api.habits as any;
    habitsMock.get.mockResolvedValue({ data: mockHabits, error: null });
    
    habitsMock.mockImplementation((params: any) => {
      const id = typeof params === 'object' ? params.habitId : params;
      return {
        stats: {
          get: vi.fn().mockResolvedValue({ 
            data: mockStats.find(s => s.habitId === id) || { habitId: id, totalCompletions: 0, completionRate: 0 }, 
            error: null 
          })
        },
        patch: vi.fn().mockResolvedValue({ data: {}, error: null }),
        delete: vi.fn().mockResolvedValue({ data: {}, error: null }),
        log: {
          post: vi.fn().mockResolvedValue({ data: {}, error: null })
        }
      };
    });
  });

  it('should render habits and stats', async () => {
    renderWithProviders(<HabitsPage />);

    expect(await screen.findByText('Morning Run')).toBeInTheDocument();
    expect(screen.getByText('Read Books')).toBeInTheDocument();
    
    // Check summary stats
    expect(screen.getByText('Active Habits')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    
    expect(screen.getByText('20 times')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('should open create dialog and create a daily habit', async () => {
    const user = userEvent.setup();
    const habitsMock = api.api.habits as any;

    renderWithProviders(<HabitsPage />);

    const newBtn = screen.getByRole('button', { name: /New Habit/i });
    await user.click(newBtn);

    expect(screen.getByText('Create Habit')).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Name/i);
    await user.type(nameInput, 'New Habit Name');
    
    const descInput = screen.getByLabelText(/Description/i);
    await user.type(descInput, 'New Habit Description');

    const submitBtn = screen.getByRole('button', { name: 'Create' });
    await user.click(submitBtn);

    expect(habitsMock.post).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New Habit Name',
      frequency: 'daily',
      space: 'personal'
    }));
  });

  it('should handle weekly habit creation with day selection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HabitsPage />);

    await user.click(screen.getByRole('button', { name: /New Habit/i }));

    await user.type(screen.getByLabelText(/Name/i), 'Weekly Habit');
    
    await user.click(screen.getByRole('button', { name: 'Weekly' }));
    
    await user.click(screen.getByRole('button', { name: 'Mon' }));
    await user.click(screen.getByRole('button', { name: 'Wed' }));

    const submitBtn = screen.getByRole('button', { name: 'Create' });
    await user.click(submitBtn);

    expect(api.api.habits.post).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Weekly Habit',
      frequency: 'weekly',
      targetDays: [1, 3]
    }));
  });

  it('should toggle habit active status', async () => {
    const user = userEvent.setup();
    const patchMock = vi.fn().mockResolvedValue({ data: {}, error: null });
    
    // api.api.habits('h1') call
    (api.api.habits as any).mockImplementation((id: string) => ({
        patch: patchMock,
        stats: { get: vi.fn().mockResolvedValue({ data: {}, error: null }) }
    }));

    renderWithProviders(<HabitsPage />);
    await screen.findByText('Morning Run');

    const powerBtn = screen.getAllByLabelText(/Disable habit/i)[0];
    await user.click(powerBtn);

    expect(patchMock).toHaveBeenCalledWith({ active: false });
  });

  it('should delete a habit', async () => {
    const user = userEvent.setup();
    const deleteMock = vi.fn().mockResolvedValue({ data: {}, error: null });
    
    (api.api.habits as any).mockImplementation((id: string) => ({
        delete: deleteMock,
        stats: { get: vi.fn().mockResolvedValue({ data: {}, error: null }) }
    }));

    renderWithProviders(<HabitsPage />);
    await screen.findByText('Morning Run');

    const trashBtn = screen.getAllByLabelText(/Delete habit/i)[0];
    await user.click(trashBtn);

    expect(deleteMock).toHaveBeenCalled();
  });

  it('should open edit dialog and update habit', async () => {
    const user = userEvent.setup();
    const patchMock = vi.fn().mockResolvedValue({ data: {}, error: null });
    (api.api.habits as any).mockImplementation((id: string) => ({
        patch: patchMock,
        stats: { get: vi.fn().mockResolvedValue({ data: {}, error: null }) }
    }));

    renderWithProviders(<HabitsPage />);

    await waitFor(() => expect(screen.getByText('Morning Run')).toBeInTheDocument());

    const editBtns = screen.getAllByLabelText('Edit habit');
    await user.click(editBtns[0]);

    expect(screen.getByText('Edit Habit')).toBeInTheDocument();
    
    const nameInput = screen.getByLabelText(/Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Name');

    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(patchMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Updated Name'
    }));
  });

  it('should show empty state when no habits', async () => {
    (api.api.habits.get as any).mockResolvedValue({ data: [], error: null });
    
    renderWithProviders(<HabitsPage />);

    expect(await screen.findByText('No habits yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Habit' })).toBeInTheDocument();
  });
});
