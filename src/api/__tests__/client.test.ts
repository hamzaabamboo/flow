import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../client';

describe('api/client', () => {
  const originalWindow = global.window;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    global.window = Object.create(window);
    Object.defineProperty(global.window, 'location', {
      value: {
        origin: 'http://localhost:3000',
        pathname: '/',
        href: ''
      },
      writable: true
    });
  });

  afterEach(() => {
    global.window = originalWindow;
    global.fetch = originalFetch;
  });

  it('should use window.location.origin as default API_URL in browser', async () => {
    const { API_URL } = await import('../client');
    expect(API_URL).toBe('http://localhost:3000');
  });

  it('should redirect to /login on 401 response if not already there', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 401
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const hrefSpy = vi.fn();
    Object.defineProperty(window.location, 'href', {
      get: () => '',
      set: hrefSpy,
      configurable: true
    });
    window.location.pathname = '/home';

    // This is tricky because the actual client isn't easily mockable here.
    // We're testing the fetcher wrapper, so we'll have to call it indirectly.
    // This is a sign the client could be refactored for easier testing.
    // For now, we accept this limitation.

    // We can't directly call the fetcher, so we call a method on the api
    // that will trigger the fetcher.
    try {
      await api.api.auth.me.get();
    } catch {
      // We expect this to fail, we just want to check the redirection
    }

    expect(hrefSpy).toHaveBeenCalledWith('/login');
  });

  it('should not redirect to /login on 401 if already on /login', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 401
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const hrefSpy = vi.fn();
    Object.defineProperty(window.location, 'href', {
      get: () => '',
      set: hrefSpy,
      configurable: true
    });
    window.location.pathname = '/login';

    try {
      await api.api.auth.me.get();
    } catch {
      // We expect this to fail, we just want to check the redirection
    }

    expect(hrefSpy).not.toHaveBeenCalled();
  });

  it('should include credentials: "include" in fetch options', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve([])
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      await api.api.auth.me.get();
    } catch {
      // We expect this to fail, we just want to check the options
    }

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        credentials: 'include'
      })
    );
  });
});
