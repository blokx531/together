import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, describeDay, parseLocalDate, type LocalDate } from '../lib/localDate';
import { IconButton } from './Button';

interface DateStepperProps {
  value: LocalDate;
  today: LocalDate;
  onChange: (date: LocalDate) => void;
  /** Disallow moving past today (e.g. for logs of things that already happened). */
  allowFuture?: boolean;
}

export function DateStepper({ value, today, onChange, allowFuture = false }: DateStepperProps) {
  const canGoForward = allowFuture || value < today;
  return (
    <div className="flex items-center gap-1">
      <IconButton
        label="Previous day"
        onClick={() => {
          onChange(addDays(value, -1));
        }}
      >
        <ChevronLeft className="size-5" aria-hidden />
      </IconButton>
      <label className="relative flex min-h-11 min-w-32 cursor-pointer items-center justify-center rounded-control px-3 font-medium hover:bg-surface-2">
        <span aria-hidden>{describeDay(value, today)}</span>
        <input
          type="date"
          aria-label="Choose date"
          value={value}
          max={allowFuture ? undefined : today}
          onChange={(event) => {
            const parsed = parseLocalDate(event.target.value);
            if (parsed) onChange(parsed);
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <IconButton
        label="Next day"
        disabled={!canGoForward}
        onClick={() => {
          onChange(addDays(value, 1));
        }}
      >
        <ChevronRight className="size-5" aria-hidden />
      </IconButton>
      {value !== today ? (
        <button
          type="button"
          onClick={() => {
            onChange(today);
          }}
          className="ml-1 min-h-9 rounded-full px-3 text-sm font-medium text-accent hover:bg-accent-soft"
        >
          Today
        </button>
      ) : null}
    </div>
  );
}
