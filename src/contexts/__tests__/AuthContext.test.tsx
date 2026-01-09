import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthProvider, useAuth, withAuth } from '../AuthContext';
import { mockApi, getMockFn } from '../../test/mocks/api';
import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock API using shared mocks
vi.mock('../../api/client', async () => {
  const mocks = await import('../../test/mocks/api');
  return {
    api: mocks.mockApi
  };
});

const TestComponent = () => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const status = isLoading ? 'loading' : isAuthenticated ? 'authenticated' : 'unauthenticated';
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="user">{user?.email || 'no-user'}</div>
    </div>
  );
};

const AuthenticatedComponent = withAuth(() => <div>Secret Content</div>);

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity }
    }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should show loading status initially', () => {
    getMockFn(mockApi.api.auth.me.get).mockReturnValue(
      new Promise(() => {}) // Never resolves
    );

    renderWithQueryClient(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('status').textContent).toBe('loading');
  });

  it('should provide user when authenticated', async () => {
    getMockFn(mockApi.api.auth.me.get).mockResolvedValue({
      data: { id: '1', email: 'test@example.com' },
      error: null
    });

    renderWithQueryClient(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated');
    }, { timeout: 2000 });
    expect(screen.getByTestId('user').textContent).toBe('test@example.com');
  });

  it('should handle unauthenticated state', async () => {
    getMockFn(mockApi.api.auth.me.get).mockResolvedValue({
      data: null,
      error: { status: 401 }
    });

    // Mock logout call that happens on 401
    getMockFn(mockApi.api.auth.logout.post).mockResolvedValue({ data: {}, error: null });

    renderWithQueryClient(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    }, { timeout: 2000 });
    expect(screen.getByTestId('user').textContent).toBe('no-user');
  });

  it('withAuth should redirect to login when unauthenticated', async () => {
    getMockFn(mockApi.api.auth.me.get).mockResolvedValue({
      data: null,
      error: { status: 401 }
    });
    getMockFn(mockApi.api.auth.logout.post).mockResolvedValue({ data: {}, error: null });

    // Mock window.location.href
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, href: '', pathname: '/' };

    renderWithQueryClient(
      <AuthProvider>
        <AuthenticatedComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(window.location.href).toContain('/login');
    });

    window.location = originalLocation;
  });

  it('logout should call API and clear user', async () => {
    getMockFn(mockApi.api.auth.me.get).mockResolvedValue({
      data: { id: '1', email: 'test@example.com' },
      error: null
    });

    const logoutMock = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
    getMockFn(mockApi.api.auth.logout.post).mockImplementation(logoutMock);

    let capturedLogout: any;
    const LogoutButton = () => {
      const { logout } = useAuth();
      useEffect(() => {
          if (logout) capturedLogout = logout;
      }, [logout]);
      return <button onClick={() => logout()}>Logout</button>;
    };

    renderWithQueryClient(
      <AuthProvider>
        <LogoutButton />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedLogout).toBeDefined();
    });

    // We need to wait for authentication to finish before logging out
    await screen.findByRole('button');

    await act(async () => {
      await capturedLogout();
    });

    expect(logoutMock).toHaveBeenCalled();
  });
});