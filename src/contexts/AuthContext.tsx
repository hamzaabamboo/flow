import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { User, AuthContextType } from '../shared/types/user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch current user
  const {
    data: user,
    isLoading,
    refetch: _refetch
  } = useQuery<User | null>({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        });

        if (!response.ok) {
          if (response.status === 401) {
            return null;
          }
          throw new Error('Failed to fetch user');
        }

        return response.json();
      } catch (error) {
        console.error('Auth check failed:', error);
        return null;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !isInitialized
  });

  useEffect(() => {
    if (!isLoading) {
      setIsInitialized(true);
    }
  }, [isLoading]);

  // Login function - redirect to login page
  const login = useCallback((returnUrl?: string) => {
    window.location.href = `/login?returnUrl=${encodeURIComponent(returnUrl || window.location.pathname)}`;
  }, []);

  // Logout mutation
  const logoutMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/require-await
    mutationFn: async () => {
      queryClient.setQueryData(['auth', 'user'], null);
      queryClient.clear();

      // Server will redirect to OIDC logout
      window.location.href = '/api/auth/logout';
    }
  });

  const value: AuthContextType = {
    user: user ?? null,
    isLoading: isLoading && !isInitialized,
    isAuthenticated: !!user,
    login,
    logout: async () => logoutMutation.mutateAsync(),
    refreshToken: async () => {}
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// HOC for protected routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: { redirectTo?: string } = {}
) {
  return function AuthenticatedComponent(props: P) {
    const { user, isLoading, login } = useAuth();

    useEffect(() => {
      if (!isLoading && !user) {
        login(options.redirectTo);
      }
    }, [user, isLoading, login]);

    if (isLoading) {
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh'
          }}
        >
          Loading...
        </div>
      );
    }

    if (!user) {
      return null;
    }

    return <Component {...props} />;
  };
}
