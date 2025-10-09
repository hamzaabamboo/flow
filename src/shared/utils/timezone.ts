import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { APP_TIMEZONE } from '../constants';

/**
 * Convert UTC date to JST
 */
export function utcToJst(date: Date): Date {
  return toZonedTime(date, APP_TIMEZONE);
}

/**
 * Convert JST date to UTC
 */
export function jstToUtc(date: Date | string): Date {
  return fromZonedTime(date, APP_TIMEZONE);
}

/**
 * Get current date/time in JST
 */
export function nowInJst(): Date {
  return utcToJst(new Date());
}

/**
 * Create a JST date from components
 */
export function createJstDate(
  year: number,
  month: number,
  day: number,
  hours: number = 0,
  minutes: number = 0,
  seconds: number = 0
): Date {
  const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return jstToUtc(dateString);
}

/**
 * Get JST date components from a UTC date
 */
export function getJstDateComponents(date: Date): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  dayOfWeek: number;
} {
  const jstDate = utcToJst(date);
  return {
    year: jstDate.getFullYear(),
    month: jstDate.getMonth() + 1,
    day: jstDate.getDate(),
    hours: jstDate.getHours(),
    minutes: jstDate.getMinutes(),
    seconds: jstDate.getSeconds(),
    dayOfWeek: jstDate.getDay()
  };
}
