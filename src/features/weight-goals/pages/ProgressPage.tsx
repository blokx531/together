import { ChevronLeft } from 'lucide-react';
import { Link } from 'wouter';
import { useHousehold, type Member } from '@/features/household';
import { addDays, todayIn, type LocalDate } from '@/shared/lib/localDate';
import { useResource } from '@/shared/lib/useResource';
import { Card } from '@/shared/ui/Card';
import { ErrorState, LoadingRows } from '@/shared/ui/States';
import { EnergyProfileCard } from '../components/EnergyProfileCard';
import { GoalCard } from '../components/GoalCard';
import { WeighInCard } from '../components/WeighInCard';
import { WeightChart } from '../components/WeightChart';
import {
  isPartnerWeightShared,
  listWeighIns,
  loadCurrentGoal,
  loadDailyIntake,
  loadEnergyProfile,
  type Goal,
  type WeighInRecord,
} from '../data/weightApi';
import { estimateMaintenance } from '../domain/energy';
import {
  goalProgress,
  MIN_TREND_POINTS,
  MIN_TREND_SPAN_DAYS,
  observedTrend,
  projectFromIntake,
  type IntakeProjection,
} from '../domain/projection';

const kg = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1, signDisplay: 'exceptZero' });

function ProgressSummary({
  goal,
  weighIns,
  projection,
}: {
  goal: Goal | null;
  weighIns: readonly WeighInRecord[];
  projection: IntakeProjection | null;
}) {
  const latest = weighIns.at(-1) ?? null;
  const progress = goalProgress(goal, latest);
  const trend = observedTrend(weighIns);
  return (
    <div className="flex flex-col gap-2 text-sm">
      {progress.kind === 'progress' ? (
        <p>
          <strong className={progress.isTowardGoal ? 'text-positive' : 'text-warning'}>
            {kg.format(progress.changeKg)} kg
          </strong>{' '}
          measured since the start
          {progress.remainingKg !== null
            ? ` · ${Math.abs(progress.remainingKg).toFixed(1)} kg to go`
            : ''}
          .
        </p>
      ) : progress.kind === 'no-measurement' ? (
        <p className="text-ink-muted">Add a weigh-in to start tracking progress.</p>
      ) : null}
      {trend ? (
        <p className="text-ink-muted">
          Measured trend: about {kg.format(trend.kgPerWeek)} kg per week over {trend.spanDays} days
          ({trend.pointCount} weigh-ins). Daily weight swings by a kilo or more with water, so read
          the trend, not single points.
        </p>
      ) : (
        <p className="text-ink-muted">
          A trend needs at least {MIN_TREND_POINTS} weigh-ins spread over {MIN_TREND_SPAN_DAYS}{' '}
          days. Missing weeks are never filled in.
        </p>
      )}
      {projection && projection.points.length > 1 ? (
        <p className="text-ink-muted">
          The dashed line assumes ~7,700 kcal ≈ 1 kg and uses only the {projection.completeDays} of{' '}
          {projection.totalDays} days you marked complete. It is a rough estimate, not a prediction.
        </p>
      ) : null}
    </div>
  );
}

function PartnerProgress({ partner }: { partner: Member }) {
  const data = useResource(`partner-weight:${partner.userId}`, async (signal) => {
    const shared = await isPartnerWeightShared(signal);
    if (!shared) return null;
    const [weighIns, goal] = await Promise.all([
      listWeighIns(partner.userId, signal),
      loadCurrentGoal(partner.userId, signal),
    ]);
    return { weighIns, goal };
  });
  if (data.status !== 'success' || data.data === null) return null;
  return (
    <Card title={`${partner.displayName}'s progress`}>
      {data.data.weighIns.length === 0 ? (
        <p className="text-sm text-ink-muted">No weigh-ins shared yet.</p>
      ) : (
        <>
          <WeightChart
            measured={data.data.weighIns}
            estimated={[]}
            targetKg={data.data.goal?.targetWeightKg ?? null}
          />
          <ProgressSummary goal={data.data.goal} weighIns={data.data.weighIns} projection={null} />
        </>
      )}
    </Card>
  );
}

export function ProgressPage() {
  const household = useHousehold();
  const today = todayIn(household.timeZone, new Date());
  const data = useResource(`progress:${household.me.userId}`, async (signal) => {
    const [profile, weighIns, goal] = await Promise.all([
      loadEnergyProfile(signal),
      listWeighIns(household.me.userId, signal),
      loadCurrentGoal(household.me.userId, signal),
    ]);
    const intake = goal ? await loadDailyIntake(goal.startDate, addDays(today, 1), signal) : [];
    return { profile, weighIns, goal, intake };
  });

  const projectionFor = (
    goal: Goal,
    weighIns: readonly WeighInRecord[],
    intake: Awaited<ReturnType<typeof loadDailyIntake>>,
    until: LocalDate,
  ) => {
    const maintenance = estimateMaintenance(
      data.status === 'success' ? data.data.profile : null,
      weighIns.at(-1)?.kg ?? goal.startWeightKg,
      until,
    );
    if (maintenance.kind === 'missing') return null;
    const startWeighIn = weighIns.find((entry) => entry.date >= goal.startDate);
    return projectFromIntake(
      startWeighIn ?? { date: goal.startDate, kg: goal.startWeightKg },
      until,
      intake,
      maintenance.kcal,
    );
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-1">
        <Link
          href="/food"
          aria-label="Back to food"
          className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Weight & goals</h1>
      </div>
      {data.status === 'loading' ? <LoadingRows rows={4} label="Loading progress" /> : null}
      {data.status === 'error' ? <ErrorState error={data.error} onRetry={data.reload} /> : null}
      {data.status === 'success'
        ? (() => {
            const { profile, weighIns, goal, intake } = data.data;
            const projection = goal ? projectionFor(goal, weighIns, intake, today) : null;
            return (
              <div className="flex flex-col gap-4">
                <Card title="Progress">
                  {weighIns.length === 0 && !goal ? (
                    <p className="text-sm text-ink-muted">
                      Set a goal and add your first weigh-in. Your weight stays private unless you
                      share it.
                    </p>
                  ) : (
                    <>
                      {weighIns.length > 0 || (projection?.points.length ?? 0) > 1 ? (
                        <WeightChart
                          measured={weighIns}
                          estimated={projection?.points ?? []}
                          targetKg={goal?.targetWeightKg ?? null}
                        />
                      ) : null}
                      <ProgressSummary goal={goal} weighIns={weighIns} projection={projection} />
                    </>
                  )}
                </Card>
                <WeighInCard today={today} history={weighIns} onSaved={data.reload} />
                <GoalCard
                  key={goal?.effectiveFrom ?? 'none'}
                  goal={goal}
                  latestKg={weighIns.at(-1)?.kg ?? null}
                  today={today}
                  onSaved={data.reload}
                />
                <EnergyProfileCard profile={profile} onSaved={data.reload} />
                {household.partner ? <PartnerProgress partner={household.partner} /> : null}
              </div>
            );
          })()
        : null}
    </>
  );
}
