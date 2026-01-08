import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLocalStorage } from '../useLocalStorage';

describe('useLocalStorage', () => {
  const key = 'test-key';
  const initialValue = { a: 1 };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('should initialize with value from localStorage', () => {
    const value = { b: 2 };
    window.localStorage.setItem(key, JSON.stringify(value));

    const { result } = renderHook(() => useLocalStorage(key, initialValue));

    expect(result.current[0]).toEqual(value);
  });

  it('should initialize with default value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage(key, initialValue));

    expect(result.current[0]).toEqual(initialValue);
  });

  it('should update localStorage when setValue is called', () => {
    const { result } = renderHook(() => useLocalStorage(key, initialValue));
    const newValue = { c: 3 };

    act(() => {
      result.current[1](newValue);
    });

    expect(result.current[0]).toEqual(newValue);
    expect(window.localStorage.getItem(key)).toBe(JSON.stringify(newValue));
  });

  it('should update state when a storage event occurs', () => {
    const { result } = renderHook(() => useLocalStorage(key, initialValue));
    const newValue = { d: 4 };

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key,
          newValue: JSON.stringify(newValue),
        })
      );
    });

    expect(result.current[0]).toEqual(newValue);
  });

  it('should handle JSON parse errors gracefully', () => {
    window.localStorage.setItem(key, 'invalid-json');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useLocalStorage(key, initialValue));

    expect(result.current[0]).toEqual(initialValue);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
