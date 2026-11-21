import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, formatLocalDate, monthRange, type LocalDate } from '@/shared/lib/localDate';
import { IconButton } from '@/shared/ui/Button';

interface MonthStepperProps {
  /** Any day inside the shown month. */
  month: LocalDate;
  today: LocalDate;
  onChange: (month: LocalDate) => void;
}

export function MonthStepper({ month, today, onChange }: MonthStepperProps) {
  const range = monthRange(month);
  const isCurrentOrFuture = range.end > today;
  return (
    <div className="flex items-center">
      <IconButton
        label="Previous month"
        onClick={() => {
          onChange(monthRange(addDays(range.start, -1)).start);
        }}
      >
        <ChevronLeft className="size-5" aria-hidden />
      </IconButton>
      <span className="min-w-32 text-center font-medium" aria-live="polite">
        {formatLocalDate(range.start, 'month-year')}
      </span>
      <IconButton
        label="Next month"
        disabled={isCurrentOrFuture}
        onClick={() => {
          onChange(range.end);
        }}
      >
        <ChevronRight className="size-5" aria-hidden />
      </IconButton>
    </div>
  );
}
