import { MoneySnapshotCard } from '@/features/expenses';
import { InvitePartnerCard, useHousehold } from '@/features/household';
import { formatLocalDate, todayIn } from '@/shared/lib/localDate';

function greetingFor(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function hourIn(timeZone: string, now: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now),
  );
}

export function HomePage() {
  const household = useHousehold();
  const now = new Date();
  const today = todayIn(household.timeZone, now);

  return (
    <>
      <header className="mb-6">
        <p className="text-sm text-ink-muted">{formatLocalDate(today, 'weekday-day-month')}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greetingFor(hourIn(household.timeZone, now))}, {household.me.displayName}
        </h1>
      </header>
      <div className="flex flex-col gap-4">
        {household.partner ? null : <InvitePartnerCard />}
        <MoneySnapshotCard />
      </div>
    </>
  );
}
