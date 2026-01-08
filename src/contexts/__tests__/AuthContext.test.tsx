import { render, screen, waitFor, act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, withAuth } from '../AuthContext';
import { api } from '../../api/client';

// Mock API
vi.mock('../../api/client', () => ({
  api: {
    api: {
      auth: {
        me: { get: vi.fn() },
        logout: { post: vi.fn() },
      },
    },
  },
}));

// Mock window.location
const originalLocation = window.location;

describe('AuthContext', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      href: '',
      pathname: '/',
    };

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  const renderWithProvider = (ui: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{ui}</AuthProvider>
      </QueryClientProvider>
    );
  };

  it('should provide user data when authenticated', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
    (api.api.auth.me.get as vi.Mock).mockResolvedValue({ data: mockUser, error: null });

    const Consumer = () => {
      const { user } = useAuth();
      return <div>{user ? user.name : 'No User'}</div>;
    };

    renderWithProvider(<Consumer />);

    await screen.findByText('Test User');
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('should handle 401 unauthenticated state', async () => {
    (api.api.auth.me.get as vi.Mock).mockResolvedValue({ data: null, error: { status: 401 } });
    (api.api.auth.logout.post as vi.Mock).mockResolvedValue({ data: {}, error: null });

    const Consumer = () => {
      const { user, isAuthenticated } = useAuth();
      return <div>{isAuthenticated ? 'Authenticated' : 'Guest'}</div>;
    };

    renderWithProvider(<Consumer />);

    await screen.findByText('Guest');
    expect(screen.getByText('Guest')).toBeInTheDocument();
    expect(api.api.auth.logout.post).toHaveBeenCalled(); // Should attempt logout on 401
  });

  it('should login by redirecting', async () => {
    (api.api.auth.me.get as vi.Mock).mockResolvedValue({ data: null, error: { status: 401 } });
    
    const Consumer = () => {
        const { login } = useAuth();
        return <button onClick={() => login('/dashboard')}>Login</button>;
    };

    renderWithProvider(<Consumer />);
    await screen.findByText('Login'); // Wait for init

    act(() => {
        screen.getByText('Login').click();
    });

    expect(window.location.href).toBe('/login?returnUrl=%2Fdashboard');
  });

  it('should logout and redirect', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    (api.api.auth.me.get as vi.Mock).mockResolvedValue({ data: mockUser, error: null });
    (api.api.auth.logout.post as vi.Mock).mockResolvedValue({ data: {}, error: null });

    const Consumer = () => {
        const { logout, user } = useAuth();
        if (!user) return null;
        return <button onClick={logout}>Logout</button>;
    };

    renderWithProvider(<Consumer />);
    await screen.findByText('Logout');

    act(() => {
        screen.getByText('Logout').click();
    });

    await waitFor(() => {
        expect(api.api.auth.logout.post).toHaveBeenCalled();
        expect(window.location.href).toBe('/login');
    });
  });

  it('withAuth should protect routes', async () => {
    // Unauthenticated
    (api.api.auth.me.get as vi.Mock).mockResolvedValue({ data: null, error: { status: 401 } });

    const Protected = withAuth(() => <div>Secret Content</div>);

    renderWithProvider(<Protected />);

    // Should not show content
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
    
    // Should redirect
    await waitFor(() => {
        expect(window.location.href).toContain('/login');
    });
  });

  it('withAuth should render content for authenticated user', async () => {
    // Authenticated
    (api.api.auth.me.get as vi.Mock).mockResolvedValue({ data: { id: '1' }, error: null });

    const Protected = withAuth(() => <div>Secret Content</div>);

    renderWithProvider(<Protected />);

    await screen.findByText('Secret Content');
    expect(screen.getByText('Secret Content')).toBeInTheDocument();
  });
});
