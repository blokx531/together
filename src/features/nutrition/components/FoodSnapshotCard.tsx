import { Link } from 'wouter';
import { useHousehold } from '@/features/household';
import { todayIn } from '@/shared/lib/localDate';
import { useResource } from '@/shared/lib/useResource';
import { Card } from '@/shared/ui/Card';
import { ErrorState, Skeleton } from '@/shared/ui/States';
import { loadDay } from '../data/nutritionApi';
import { totalsOf } from '../domain/calories';

const kcalFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** Home-screen summary: calories logged today by you and (if shared) your partner. */
export function FoodSnapshotCard() {
  const household = useHousehold();
  const today = todayIn(household.timeZone, new Date());
  const data = useResource(`home-food:${today}`, async (signal) => {
    const [mine, partner] = await Promise.all([
      loadDay(household.me.userId, today, signal),
      household.partner ? loadDay(household.partner.userId, today, signal) : Promise.resolve(null),
    ]);
    return {
      mineKcal: totalsOf(mine.meals.flatMap((m) => m.items)).kcal,
      partnerKcal: partner ? totalsOf(partner.meals.flatMap((m) => m.items)).kcal : null,
    };
  });
  return (
    <Card
      title="Food today"
      action={
        <Link href="/food" className="text-sm font-medium text-accent">
          Log food
        </Link>
      }
    >
      {data.status === 'loading' ? <Skeleton className="h-12" /> : null}
      {data.status === 'error' ? <ErrorState error={data.error} onRetry={data.reload} /> : null}
      {data.status === 'success' ? (
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-sm text-ink-muted">You</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {kcalFormat.format(data.data.mineKcal)} kcal
            </dd>
          </div>
          {household.partner && data.data.partnerKcal !== null ? (
            <div>
              <dt className="text-sm text-ink-muted">{household.partner.displayName} (shared)</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {kcalFormat.format(data.data.partnerKcal)} kcal
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </Card>
  );
}
