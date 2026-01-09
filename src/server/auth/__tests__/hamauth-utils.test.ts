import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateHamAuthToken, validateHamAuthTokenCached, HAMAUTH_CONFIG } from '../hamauth-utils';

describe('hamauth-utils', () => {
  const mockAccessToken = 'test-token';
  const mockUserInfo = { sub: 'u1', email: 'test@example.com', name: 'Test User' };

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure config is set
    HAMAUTH_CONFIG.issuer = 'http://auth.example.com';
    HAMAUTH_CONFIG.userInfoEndpoint = 'http://auth.example.com/userinfo';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validateHamAuthToken should return userInfo on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUserInfo)
    }) as unknown as typeof fetch;

    const result = await validateHamAuthToken(mockAccessToken);
    expect(result).toEqual(mockUserInfo);
  });

  it('validateHamAuthToken should return null if config missing', async () => {
    const originalIssuer = HAMAUTH_CONFIG.issuer;
    HAMAUTH_CONFIG.issuer = '';
    const result = await validateHamAuthToken(mockAccessToken);
    expect(result).toBeNull();
    HAMAUTH_CONFIG.issuer = originalIssuer;
  });

  it('validateHamAuthToken should return null if email missing in response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sub: 'u1' }) // No email
    }) as unknown as typeof fetch;

    const result = await validateHamAuthToken(mockAccessToken);
    expect(result).toBeNull();
  });

  it('validateHamAuthTokenCached should cache the result', async () => {
    const token = 'token-cache';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUserInfo)
    }) as unknown as typeof fetch;

    // First call - should fetch
    const result1 = await validateHamAuthTokenCached(token);
    expect(result1).toEqual(mockUserInfo);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second call - should return cached
    const result2 = await validateHamAuthTokenCached(token);
    expect(result2).toEqual(mockUserInfo);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('validateHamAuthTokenCached should re-fetch after cache expiration', async () => {
    const token = 'token-exp';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUserInfo)
    }) as unknown as typeof fetch;

    await validateHamAuthTokenCached(token);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Advance time by 2 minutes (cache is 1 minute)
    vi.advanceTimersByTime(2 * 60 * 1000);

    await validateHamAuthTokenCached(token);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('validateHamAuthTokenCached should remove from cache on failure', async () => {
    const token = 'token-fail';
    // 1. Success first
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockUserInfo)
    }) as unknown as typeof fetch;

    await validateHamAuthTokenCached(token);

    // 2. Failure next (after expiration)
    vi.advanceTimersByTime(2 * 60 * 1000);
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401
    }) as unknown as typeof fetch;

    const result = await validateHamAuthTokenCached(token);
    expect(result).toBeNull();
  });
});
