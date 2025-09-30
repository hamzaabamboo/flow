import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to sync state with URL query parameters
 * @param key - The query parameter key
 * @param defaultValue - Default value if query param is not present
 * @returns [value, setValue] tuple similar to useState
 */
export function useQueryState<T extends string>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  // Parse initial value from URL
  const getInitialValue = useCallback((): T => {
    if (typeof window === 'undefined') return defaultValue;

    const params = new URLSearchParams(window.location.search);
    const value = params.get(key);
    return (value as T) || defaultValue;
  }, [key, defaultValue]);

  const [state, setState] = useState<T>(getInitialValue);

  // Update URL when state changes
  const setValue = useCallback(
    (newValue: T) => {
      setState(newValue);

      if (typeof window === 'undefined') return;

      const url = new URL(window.location.href);
      const params = url.searchParams;

      if (newValue === defaultValue) {
        // Remove param if it's the default value
        params.delete(key);
      } else {
        params.set(key, newValue);
      }

      // Update URL without page reload
      const newUrl = params.toString() ? `${url.pathname}?${params.toString()}` : url.pathname;

      window.history.replaceState({}, '', newUrl);
    },
    [key, defaultValue]
  );

  // Sync state with URL on mount and when URL changes
  useEffect(() => {
    const handlePopState = () => {
      setState(getInitialValue());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [getInitialValue]);

  return [state, setValue];
}

/**
 * Hook for date-based query state
 * @param key - The query parameter key
 * @param defaultDate - Default date (defaults to today)
 * @returns [date, setDate] tuple
 */
export function useDateQueryState(key: string, defaultDate?: Date): [Date, (date: Date) => void] {
  const today = defaultDate || new Date();
  today.setHours(0, 0, 0, 0);
  const defaultValue = today.toISOString().split('T')[0];

  const getInitialDate = useCallback((): Date => {
    if (typeof window === 'undefined') return today;

    const params = new URLSearchParams(window.location.search);
    const dateStr = params.get(key);

    if (dateStr) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        date.setHours(0, 0, 0, 0);
        return date;
      }
    }

    return today;
  }, [key, today]);

  const [date, setDateState] = useState<Date>(getInitialDate);

  const setDate = useCallback(
    (newDate: Date) => {
      setDateState(newDate);

      if (typeof window === 'undefined') return;

      const url = new URL(window.location.href);
      const params = url.searchParams;
      const dateStr = newDate.toISOString().split('T')[0];

      if (dateStr === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, dateStr);
      }

      const newUrl = params.toString() ? `${url.pathname}?${params.toString()}` : url.pathname;

      window.history.replaceState({}, '', newUrl);
    },
    [key, defaultValue]
  );

  useEffect(() => {
    const handlePopState = () => {
      setDateState(getInitialDate());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [getInitialDate]);

  return [date, setDate];
}
