/**
 * Calendar-day values ("2026-11-21") for meals, weigh-ins, expenses and visits. They are stored as
 * Postgres `date` and never converted through UTC instants, so a meal logged at 23:50 in Kolkata
 * stays on that day. "Today" is computed for an explicit IANA time zone and an injected `now`.
 */
export type LocalDate = string & { readonly __brand: 'LocalDate' };

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

export function parseLocalDate(value: string): LocalDate | null {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const probe = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day;
  return isRealDate ? (value as LocalDate) : null;
}

function toUtcDate(date: LocalDate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function fromUtcDate(date: Date): LocalDate {
  return date.toISOString().slice(0, 10) as LocalDate;
}

export function todayIn(timeZone: string, now: Date): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}` as LocalDate;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcDate(new Date(toUtcDate(date).getTime() + days * MS_PER_DAY));
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / MS_PER_DAY);
}

export interface DateRange {
  /** Inclusive. */
  start: LocalDate;
  /** Exclusive. */
  end: LocalDate;
}

export function monthRange(date: LocalDate): DateRange {
  const d = toUtcDate(date);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { start: fromUtcDate(start), end: fromUtcDate(end) };
}

/** Monday-based week containing `date`. */
export function weekRange(date: LocalDate): DateRange {
  const weekday = (toUtcDate(date).getUTCDay() + 6) % 7;
  const start = addDays(date, -weekday);
  return { start, end: addDays(start, 7) };
}

export function isWithin(date: LocalDate, range: DateRange): boolean {
  return date >= range.start && date < range.end;
}

type DateStyle = 'weekday-day-month' | 'day-month-year' | 'month-year' | 'day-month';

const FORMAT_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  'weekday-day-month': { weekday: 'short', day: 'numeric', month: 'short' },
  'day-month-year': { day: 'numeric', month: 'short', year: 'numeric' },
  'month-year': { month: 'long', year: 'numeric' },
  'day-month': { day: 'numeric', month: 'short' },
};

/** Formats a calendar day without any time-zone shift (the value is already local). */
export function formatLocalDate(date: LocalDate, style: DateStyle, locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(locale, { ...FORMAT_OPTIONS[style], timeZone: 'UTC' }).format(
    toUtcDate(date),
  );
}

/** "Today", "Yesterday", "Tomorrow" or a short date, relative to `today`. */
export function describeDay(date: LocalDate, today: LocalDate): string {
  const offset = daysBetween(today, date);
  if (offset === 0) return 'Today';
  if (offset === -1) return 'Yesterday';
  if (offset === 1) return 'Tomorrow';
  return formatLocalDate(date, 'weekday-day-month');
}
