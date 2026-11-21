import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  describeDay,
  formatLocalDate,
  monthRange,
  parseLocalDate,
  todayIn,
  weekRange,
  type LocalDate,
} from './localDate';

const d = (value: string) => {
  const parsed = parseLocalDate(value);
  if (!parsed) throw new Error(`bad test date ${value}`);
  return parsed;
};

describe('parseLocalDate', () => {
  it('accepts real calendar days, including leap days', () => {
    expect(parseLocalDate('2028-02-29')).toBe('2028-02-29');
  });
  it('rejects impossible or malformed dates', () => {
    for (const bad of ['2027-02-29', '2026-13-01', '2026-1-1', '21/11/2026', '']) {
      expect(parseLocalDate(bad)).toBeNull();
    }
  });
});

describe('todayIn', () => {
  it('uses the Kolkata calendar day near midnight, not the UTC day', () => {
    // 18:40 UTC = 00:10 IST the next day.
    expect(todayIn('Asia/Kolkata', new Date('2026-11-21T18:40:00Z'))).toBe('2026-11-22');
    // 18:20 UTC = 23:50 IST the same day.
    expect(todayIn('Asia/Kolkata', new Date('2026-11-21T18:20:00Z'))).toBe('2026-11-21');
  });
  it('respects other zones', () => {
    expect(todayIn('America/New_York', new Date('2026-11-22T03:00:00Z'))).toBe('2026-11-21');
  });
});

describe('date arithmetic', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(d('2028-03-01'), -1)).toBe('2028-02-29');
  });
  it('counts days between dates', () => {
    expect(daysBetween(d('2026-11-01'), d('2026-12-01'))).toBe(30);
    expect(daysBetween(d('2026-12-01'), d('2026-11-01'))).toBe(-30);
  });
  it('computes month ranges with an exclusive end', () => {
    expect(monthRange(d('2026-02-14'))).toEqual({ start: '2026-02-01', end: '2026-03-01' });
    expect(monthRange(d('2026-12-31'))).toEqual({ start: '2026-12-01', end: '2027-01-01' });
  });
  it('computes Monday-based weeks', () => {
    // 2026-11-21 is a Saturday.
    expect(weekRange(d('2026-11-21'))).toEqual({ start: '2026-11-16', end: '2026-11-23' });
    expect(weekRange(d('2026-11-16')).start).toBe('2026-11-16');
  });
});

describe('formatting', () => {
  it('formats without shifting the day', () => {
    expect(formatLocalDate(d('2026-11-21'), 'day-month-year')).toBe('21 Nov 2026');
  });
  it('describes nearby days', () => {
    const today = d('2026-11-21');
    expect(describeDay(today, today)).toBe('Today');
    expect(describeDay(addDays(today, -1), today)).toBe('Yesterday');
    expect(describeDay('2026-11-10' as LocalDate, today)).toBe('Tue, 10 Nov');
  });
});
