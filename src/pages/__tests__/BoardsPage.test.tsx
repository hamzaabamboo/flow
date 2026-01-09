import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BoardsPage from '../boards/+Page';
import { SpaceContext } from '../../contexts/SpaceContext';
import { AuthContext } from '../../contexts/AuthContext';
import { DialogProvider } from '../../utils/useDialogs';

// Mock vike/client/router
vi.mock('vike/client/router', () => ({
  navigate: vi.fn()
}));

const renderWithProviders = (
  ui: React.ReactElement,
  { isAuthenticated = true, currentSpace = 'personal' } = {}
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={
          { isAuthenticated, login: vi.fn(), logout: vi.fn(), user: null, loading: false } as any
        }
      >
        <SpaceContext.Provider value={{ currentSpace, setCurrentSpace: vi.fn() } as any}>
          <DialogProvider>{ui}</DialogProvider>
        </SpaceContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};

describe('BoardsPage', () => {
  const mockBoards = [
    { id: 'b1', name: 'Project Alpha', updatedAt: new Date().toISOString() },
    { id: 'b2', name: 'Project Beta', updatedAt: new Date(Date.now() - 1000).toISOString() }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockBoards)
    } as any);
  });

  it('should render boards when authenticated', async () => {
    renderWithProviders(<BoardsPage />);

    expect(await screen.findByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
  });

  it('should show login prompt when not authenticated', () => {
    renderWithProviders(<BoardsPage />, { isAuthenticated: false });

    expect(screen.getByText(/Please log in to continue/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log in with OAuth/i })).toBeInTheDocument();
  });

  it('should show empty state when no boards', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    } as any);

    renderWithProviders(<BoardsPage />);

    expect(await screen.findByText(/No boards yet/i)).toBeInTheDocument();
  });

  it('should open new board dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BoardsPage />);

    const newBtn = await screen.findByRole('button', { name: /\+ New Board/i });
    await user.click(newBtn);

    expect(await screen.findByText(/Create New Board/i)).toBeInTheDocument();
  });
});
