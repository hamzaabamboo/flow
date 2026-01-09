import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AnalyticsPage from '../analytics/+Page';
import { SpaceContext } from '../../contexts/SpaceContext';
import { mockApi, getMockFn } from '../../test/mocks/api';

// Mock API using shared mocks
vi.mock('../../api/client', async () => {
  const mocks = await import('../../test/mocks/api');
  return {
    api: mocks.mockApi
  };
});

const mockSpaceContext = {
  currentSpace: 'personal' as const,
  spaces: [],
  setSpaces: vi.fn(),
  setCurrentSpace: vi.fn(),
  getSpaceById: vi.fn(),
  toggleSpace: vi.fn()
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false
    }
  }
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <SpaceContext.Provider value={mockSpaceContext}>{ui}</SpaceContext.Provider>
    </QueryClientProvider>
  );
};

// New structure matching API update
const mockAnalyticsResponse = {
  completions: [
    {
      date: '2024-07-14',
      count: 2,
      tasks: [
        { id: '1', title: 'Task 1', dueDate: '2024-07-14T10:00:00Z', priority: 'high' },
        { id: '2', title: 'Task 2', dueDate: '2024-07-14T11:00:00Z', priority: 'medium' }
      ]
    },
    {
      date: '2024-07-13',
      count: 2,
      tasks: [
        { id: '3', title: 'Task 3', dueDate: '2024-07-13T12:00:00Z', priority: 'low' },
        { id: '4', title: 'Task 4', dueDate: '2024-07-13T13:00:00Z', priority: 'high' }
      ]
    },
    {
      date: '2024-07-12',
      count: 1,
      tasks: [{ id: '5', title: 'Task 5', dueDate: '2024-07-12T14:00:00Z', priority: 'urgent' }]
    }
  ]
};

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    // Mock get to return a successful response with mock data
    getMockFn(mockApi.api.stats.analytics.completions.get).mockResolvedValue({
      data: mockAnalyticsResponse,
      error: null
    });
  });

  it('should render the header and date range selector', () => {
    renderWithProviders(<AnalyticsPage />);
    expect(screen.getByRole('heading', { name: /Task Analytics/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Track your task completion statistics over time/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Date Range/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Last 7 Days/i })).toBeInTheDocument();
  });

  it('should display loading spinner while fetching data', async () => {
    // Make the query take time to resolve
    getMockFn(mockApi.api.stats.analytics.completions.get).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: mockAnalyticsResponse, error: null }), 100)
        )
    );

    renderWithProviders(<AnalyticsPage />);

    expect(screen.getByText(/Loading analytics.../i)).toBeInTheDocument();

    // Wait for the loading to finish
    await screen.findByText(/Total Completed/i);
  });

  it('should display stats correctly after data is loaded', async () => {
    renderWithProviders(<AnalyticsPage />);

    await screen.findByText('Total Completed');

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('0.6')).toBeInTheDocument(); // Avg per day (5 tasks / 8 days)
    expect(screen.getByText('Completions by Priority')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // High priority
    expect(screen.getAllByText('1')).toHaveLength(3); // Medium, Low, Urgent
  });

  it('should display daily breakdown of completed tasks', async () => {
    renderWithProviders(<AnalyticsPage />);

    await screen.findByText('Daily Breakdown');

    expect(screen.getByText(/Jul 14, 2024/i)).toBeInTheDocument();
    expect(screen.getAllByText('2 tasks')).toHaveLength(2);

    expect(screen.getByText(/Jul 13, 2024/i)).toBeInTheDocument();

    expect(screen.getByText(/Jul 12, 2024/i)).toBeInTheDocument();
    expect(screen.getByText('1 tasks')).toBeInTheDocument();
  });

  it('should switch date ranges and refetch data', async () => {
    renderWithProviders(<AnalyticsPage />);

    await screen.findByText('Total Completed');

    // Initial fetch for 'Last 7 Days'
    expect(mockApi.api.stats.analytics.completions.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Last 30 Days/i }));
    });

    // Should have been called again for the new date range
    expect(mockApi.api.stats.analytics.completions.get).toHaveBeenCalledTimes(2);

    expect(screen.getByText(/Last 30 Days:/i)).toBeInTheDocument();
  });

  it('should display a message when there are no completed tasks', async () => {
    getMockFn(mockApi.api.stats.analytics.completions.get).mockResolvedValue({
      data: { completions: [] },
      error: null
    });

    renderWithProviders(<AnalyticsPage />);

    await screen.findByText('Daily Breakdown');

    expect(screen.getByText(/No completed tasks in this date range/i)).toBeInTheDocument();
    // Check summary stats are zero
    expect(screen.getByText('Total Completed')).toBeInTheDocument();
    const totalCount = screen.getAllByText('0');
    expect(totalCount.length).toBeGreaterThan(0);
  });

  it('should handle API errors gracefully', async () => {
    // Mock the query to return an error state
    getMockFn(mockApi.api.stats.analytics.completions.get).mockRejectedValue(
      new Error('Network Error')
    );

    renderWithProviders(<AnalyticsPage />);

    // Check that the error message is displayed
    await screen.findByText(/Failed to load analytics data/i);
    expect(screen.getByText(/Failed to load analytics data/i)).toBeInTheDocument();
  });
});
