import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useQueryState, useDateQueryState } from '../useQueryState';

describe('useQueryState hooks', () => {
  const originalLocation = window.location;
  const originalHistory = window.history;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window.location
    // @ts-expect-error TS is complaining about deleting read-only property, but this is how we mock it.
    delete global.window.location;
    window.location = {
      ...originalLocation,
      search: '',
      href: 'http://localhost/',
      pathname: '/',
    };

    // Mock window.history.replaceState
    window.history.replaceState = vi.fn();
  });

  afterEach(() => {
    window.location = originalLocation;
    window.history.replaceState = originalHistory.replaceState;
  });

  describe('useQueryState', () => {
    it('should initialize with default value when no param present', () => {
      const { result } = renderHook(() => useQueryState('test', 'default'));
      expect(result.current[0]).toBe('default');
    });

    it('should initialize with value from URL', () => {
      window.location.search = '?test=url-value';
      const { result } = renderHook(() => useQueryState('test', 'default'));
      expect(result.current[0]).toBe('url-value');
    });

    it('should update URL when setValue is called', () => {
      const { result } = renderHook(() => useQueryState('test', 'default'));
      
      act(() => {
        result.current[1]('new-value');
      });

      expect(result.current[0]).toBe('new-value');
      expect(window.history.replaceState).toHaveBeenCalledWith(
        expect.any(Object),
        '',
        '/?test=new-value'
      );
    });

    it('should remove param from URL when set to default value', () => {
      window.location.search = '?test=other';
      const { result } = renderHook(() => useQueryState('test', 'default'));
      
      act(() => {
        result.current[1]('default');
      });

      expect(result.current[0]).toBe('default');
      expect(window.history.replaceState).toHaveBeenCalledWith(
        expect.any(Object),
        '',
        '/'
      );
    });

    it('should update state on popstate event', () => {
      const { result } = renderHook(() => useQueryState('test', 'default'));
      
      window.location.search = '?test=pop-value';
      act(() => {
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(result.current[0]).toBe('pop-value');
    });
  });

  describe('useDateQueryState', () => {
    it('should initialize with default date (today) when no param present', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { result } = renderHook(() => useDateQueryState('date'));
      
      expect(result.current[0].getTime()).toBe(today.getTime());
    });

    it('should initialize with date from URL', () => {
      window.location.search = '?date=2024-12-25';
      const { result } = renderHook(() => useDateQueryState('date'));
      
      expect(result.current[0].getFullYear()).toBe(2024);
      expect(result.current[0].getMonth()).toBe(11); // 0-based
      expect(result.current[0].getDate()).toBe(25);
    });

    it('should update URL when setDate is called', () => {
      const { result } = renderHook(() => useDateQueryState('date'));
      const newDate = new Date('2025-01-01');
      
      act(() => {
        result.current[1](newDate);
      });

      expect(window.history.replaceState).toHaveBeenCalledWith(
        expect.any(Object),
        '',
        '/?date=2025-01-01'
      );
    });
  });
});
