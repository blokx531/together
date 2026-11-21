import { Link } from 'wouter';
import { useHousehold } from '@/features/household';
import type { LocalDate } from '@/shared/lib/localDate';
import { useResource } from '@/shared/lib/useResource';
import { Card } from '@/shared/ui/Card';
import { ErrorState, Skeleton } from '@/shared/ui/States';
import { listWeighIns, loadEnergyProfile } from '../data/weightApi';
import { energyBalance, estimateMaintenance } from '../domain/energy';

const kcal = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

interface EnergySummaryCardProps {
  date: LocalDate;
  eatenKcal: number;
  isDayComplete: boolean;
}

/** Calories eaten vs. estimated maintenance and the optional intake target, for one day. */
export function EnergySummaryCard({ date, eatenKcal, isDayComplete }: EnergySummaryCardProps) {
  const household = useHousehold();
  const context = useResource(`energy:${household.me.userId}`, async (signal) => {
    const [profile, weighIns] = await Promise.all([
      loadEnergyProfile(signal),
      listWeighIns(household.me.userId, signal),
    ]);
    return { profile, latestKg: weighIns.at(-1)?.kg ?? null };
  });

  return (
    <Card
      title="Energy today"
      action={
        <Link href="/food/progress" className="text-sm font-medium text-accent">
          Goals
        </Link>
      }
    >
      {context.status === 'loading' ? <Skeleton className="h-16" /> : null}
      {context.status === 'error' ? (
        <ErrorState error={context.error} onRetry={context.reload} />
      ) : null}
      {context.status === 'success'
        ? (() => {
            const maintenance = estimateMaintenance(
              context.data.profile,
              context.data.latestKg,
              date,
            );
            const target = context.data.profile?.dailyIntakeTargetKcal ?? null;
            const eatenTile = (
              <div>
                <dt className="text-sm text-ink-muted">Eaten</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {kcal.format(eatenKcal)} kcal
                </dd>
              </div>
            );
            if (maintenance.kind === 'missing') {
              return (
                <>
                  <dl>{eatenTile}</dl>
                  <p className="mt-2 text-sm text-ink-muted">
                    To estimate your deficit or surplus, add {maintenance.missing.join(', ')} on the{' '}
                    <Link href="/food/progress" className="font-medium text-accent">
                      goals page
                    </Link>
                    .
                  </p>
                </>
              );
            }
            const balance = energyBalance(eatenKcal, maintenance.kcal, target);
            return (
              <>
                <dl className="grid grid-cols-2 gap-3">
                  {eatenTile}
                  <div>
                    <dt className="text-sm text-ink-muted">Est. maintenance</dt>
                    <dd className="text-2xl font-semibold tabular-nums">
                      {kcal.format(maintenance.kcal)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-ink-muted">
                      {balance.kind === 'surplus' ? 'Est. surplus' : 'Est. deficit'}
                    </dt>
                    <dd
                      className={`text-lg font-semibold tabular-nums ${balance.kind === 'surplus' ? 'text-warning' : 'text-positive'}`}
                    >
                      ~{kcal.format(Math.abs(balance.balanceKcal))} kcal
                    </dd>
                  </div>
                  {balance.remainingToTargetKcal !== null ? (
                    <div>
                      <dt className="text-sm text-ink-muted">
                        {balance.remainingToTargetKcal >= 0 ? 'Left to target' : 'Over target'}
                      </dt>
                      <dd className="text-lg font-semibold tabular-nums">
                        {kcal.format(Math.abs(balance.remainingToTargetKcal))} kcal
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <p className="mt-2 text-xs text-ink-subtle">
                  {maintenance.kind === 'formula'
                    ? `Maintenance estimated with Mifflin-St Jeor × activity (${maintenance.factor}). `
                    : 'Maintenance is the value you entered. '}
                  {isDayComplete
                    ? 'Estimates, not measurements.'
                    : 'Today is not marked complete, so the deficit may be overstated.'}
                </p>
              </>
            );
          })()
        : null}
    </Card>
  );
}
