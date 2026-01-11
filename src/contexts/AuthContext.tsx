import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { User, AuthContextType } from '@hamflow/shared';
export type { AuthContextType };
import { api } from '../api/client';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
        const { data, error } = await api.api.auth.me.get();

        if (error) {
          if (error.status === 401) {
            // Clear any stale cookies by attempting logout
            try {
              await api.api.auth.logout.post();
            } catch {
              // Ignore logout errors
            }
            // Clear all cookies manually as fallback
            document.cookie.split(';').forEach((c) => {
              document.cookie = c
                .replace(/^ +/, '')
                .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
            });
            return null;
          }
          throw new Error('Failed to fetch user');
        }

        return data as User;
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
    mutationFn: async () => {
      try {
        // Call the logout endpoint
        await api.api.auth.logout.post();

        // Clear client-side state
        queryClient.setQueryData(['auth', 'user'], null);
        queryClient.clear();

        // Redirect to login page
        window.location.href = '/login';
      } catch (error) {
        console.error('Logout failed:', error);
        // Still redirect even if request fails
        window.location.href = '/login';
      }
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
