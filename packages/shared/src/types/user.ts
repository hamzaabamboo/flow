// User and Auth related types

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (returnUrl?: string) => void;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}
