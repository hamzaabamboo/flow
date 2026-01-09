import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import LoginPage from '../login/+Page';

describe('LoginPage', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      href: '',
      search: ''
    };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('should render the login card correctly', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: /Welcome to HamFlow/i })).toBeInTheDocument();
    expect(screen.getByText(/Sign in to continue/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/Secure OAuth authentication/i)).toBeInTheDocument();
  });

  it('should redirect to OAuth login on button click', () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(window.location.href).toBe('/api/auth/login?returnUrl=%2F');
  });

  it('should preserve returnUrl when redirecting', () => {
    window.location.search = '?returnUrl=%2Ftasks';
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(window.location.href).toBe('/api/auth/login?returnUrl=%2Ftasks');
  });
});
