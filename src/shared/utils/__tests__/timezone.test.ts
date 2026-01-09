import { describe, it, expect } from 'vitest';
import { utcToJst, jstToUtc, nowInJst, createJstDate, getJstDateComponents } from '../timezone';

describe('timezone utils', () => {
  it('utcToJst should convert UTC to JST (+9)', () => {
    const utcDate = new Date('2024-01-01T00:00:00Z');
    const jstDate = utcToJst(utcDate);

    // JST is UTC+9, so it should be 9:00 AM
    expect(jstDate.getHours()).toBe(9);
    expect(jstDate.getDate()).toBe(1);
  });

  it('jstToUtc should convert JST to UTC (-9)', () => {
    // A Date object representing 9 AM in local time, but we tell the function it's JST
    const jstDate = new Date('2024-01-01T09:00:00');
    const utcDate = jstToUtc(jstDate);

    expect(utcDate.getUTCHours()).toBe(0);
  });

  it('nowInJst should return a date', () => {
    const now = nowInJst();
    expect(now).toBeInstanceOf(Date);
  });

  it('createJstDate should create a UTC date from JST components', () => {
    const date = createJstDate(2024, 1, 1, 9, 0, 0);
    expect(date.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('getJstDateComponents should return correct components', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const comps = getJstDateComponents(date);

    expect(comps.year).toBe(2024);
    expect(comps.month).toBe(1);
    expect(comps.day).toBe(1);
    expect(comps.hours).toBe(9);
    expect(comps.minutes).toBe(0);
  });
});
