import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, type ReactElement, type ReactNode } from 'react';
import BoardsPage from '../boards/+Page';
import { SpaceContext, SpaceContextType } from '../../contexts/SpaceContext';
import { AuthContext, AuthContextType } from '../../contexts/AuthContext';
import { DialogProvider } from '../../utils/useDialogs';

// Mock vike/client/router
vi.mock('vike/client/router', () => ({
  navigate: vi.fn()
}));

function TestProviders({
  children,
  queryClient,
  isAuthenticated,
  currentSpace
}: {
  children: ReactNode;
  queryClient: QueryClient;
  isAuthenticated: boolean;
  currentSpace: 'work' | 'personal';
}) {
  const authValue = useMemo(
    () =>
      ({
        isAuthenticated,
        login: vi.fn(),
        logout: vi.fn(),
        user: null,
        loading: false,
        refreshToken: vi.fn()
      }) as unknown as AuthContextType,
    [isAuthenticated]
  );
  const spaceValue = useMemo(
    () =>
      ({
        currentSpace,
        setCurrentSpace: vi.fn(),
        toggleSpace: vi.fn()
      }) as SpaceContextType,
    [currentSpace]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <SpaceContext.Provider value={spaceValue}>
          <DialogProvider>{children}</DialogProvider>
        </SpaceContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

const renderWithProviders = (
  ui: ReactElement,
  { isAuthenticated = true, currentSpace = 'personal' as const } = {}
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <TestProviders
      queryClient={queryClient}
      isAuthenticated={isAuthenticated}
      currentSpace={currentSpace}
    >
      {ui}
    </TestProviders>
  );
};

describe('BoardsPage', () => {
  const mockBoards = [
    { id: 'b1', name: 'Project Alpha', updatedAt: new Date().toISOString() },
    { id: 'b2', name: 'Project Beta', updatedAt: new Date(Date.now() - 1000).toISOString() }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockBoards)
    } as unknown as Response) as unknown as typeof fetch;
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
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    } as unknown as Response) as unknown as typeof fetch;

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
