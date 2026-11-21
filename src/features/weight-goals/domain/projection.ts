import { addDays, daysBetween, type LocalDate } from '@/shared/lib/localDate';

/**
 * Approximate early model: ~7,700 kcal of cumulative energy deficit ≈ 1 kg of body-weight change.
 * Real change is not linear (water, glycogen, adaptation, logging error), so the result is always
 * labelled an estimate and only fully logged days contribute.
 */
export const KCAL_PER_KG = 7700;

export interface WeighIn {
  date: LocalDate;
  kg: number;
}

export interface DailyIntake {
  date: LocalDate;
  kcal: number;
  isComplete: boolean;
}

export interface ProjectionPoint {
  date: LocalDate;
  kg: number;
}

export interface IntakeProjection {
  points: ProjectionPoint[];
  /** Complete days used vs. days in the window, so the UI can say how much data backs the line. */
  completeDays: number;
  totalDays: number;
}

/**
 * Estimated weight path from `start` through `until`, applying (maintenance − intake) / 7,700 for each
 * fully logged day. Incomplete or unlogged days add nothing (they are not treated as zero intake).
 */
export function projectFromIntake(
  start: WeighIn,
  until: LocalDate,
  intake: readonly DailyIntake[],
  maintenanceKcal: number,
): IntakeProjection {
  const byDate = new Map(intake.map((day) => [day.date, day]));
  const totalDays = Math.max(0, daysBetween(start.date, until));
  const points: ProjectionPoint[] = [{ date: start.date, kg: start.kg }];
  let cumulativeDeficit = 0;
  let completeDays = 0;
  for (let offset = 0; offset < totalDays; offset += 1) {
    const date = addDays(start.date, offset);
    const day = byDate.get(date);
    if (day?.isComplete) {
      cumulativeDeficit += maintenanceKcal - day.kcal;
      completeDays += 1;
    }
    points.push({ date: addDays(date, 1), kg: round2(start.kg - cumulativeDeficit / KCAL_PER_KG) });
  }
  return { points, completeDays, totalDays };
}

export interface ObservedTrend {
  /** Least-squares slope, kg per week (negative = losing). */
  kgPerWeek: number;
  pointCount: number;
  spanDays: number;
}

export const MIN_TREND_POINTS = 3;
export const MIN_TREND_SPAN_DAYS = 14;

/** Linear trend of measured weigh-ins; null when there is too little data to say anything. */
export function observedTrend(weighIns: readonly WeighIn[]): ObservedTrend | null {
  if (weighIns.length < MIN_TREND_POINTS) return null;
  const sorted = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return null;
  const spanDays = daysBetween(first.date, last.date);
  if (spanDays < MIN_TREND_SPAN_DAYS) return null;
  const xs = sorted.map((w) => daysBetween(first.date, w.date));
  const ys = sorted.map((w) => w.kg);
  const meanX = xs.reduce((s, x) => s + x, 0) / xs.length;
  const meanY = ys.reduce((s, y) => s + y, 0) / ys.length;
  let numerator = 0;
  let denominator = 0;
  xs.forEach((x, i) => {
    numerator += (x - meanX) * ((ys[i] ?? meanY) - meanY);
    denominator += (x - meanX) ** 2;
  });
  if (denominator === 0) return null;
  return { kgPerWeek: round2((numerator / denominator) * 7), pointCount: sorted.length, spanDays };
}

/** Change beyond which a weigh-in is gently flagged for confirmation (not rejected). */
const OUTLIER_KG_PER_DAY = 0.5;
const OUTLIER_MIN_KG = 2;

/** True when `entry` differs from the nearest earlier weigh-in by more than plausible day-to-day noise. */
export function isPossibleOutlier(entry: WeighIn, history: readonly WeighIn[]): boolean {
  const previous = [...history]
    .filter((w) => w.date < entry.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!previous) return false;
  const days = Math.max(1, daysBetween(previous.date, entry.date));
  const allowed = Math.max(OUTLIER_MIN_KG, OUTLIER_KG_PER_DAY * days);
  return Math.abs(entry.kg - previous.kg) > allowed;
}

export type GoalProgress =
  | { kind: 'no-goal' }
  | { kind: 'no-measurement' }
  | {
      kind: 'progress';
      changeKg: number;
      remainingKg: number | null;
      fraction: number | null;
      isTowardGoal: boolean;
    };

export interface GoalForProgress {
  goalType: 'lose' | 'gain' | 'maintain';
  startWeightKg: number;
  targetWeightKg: number | null;
}

/** Measured progress only: start weight vs. latest weigh-in. */
export function goalProgress(goal: GoalForProgress | null, latest: WeighIn | null): GoalProgress {
  if (!goal) return { kind: 'no-goal' };
  if (!latest) return { kind: 'no-measurement' };
  const changeKg = round2(latest.kg - goal.startWeightKg);
  if (goal.goalType === 'maintain' || goal.targetWeightKg === null) {
    return {
      kind: 'progress',
      changeKg,
      remainingKg: null,
      fraction: null,
      isTowardGoal: goal.goalType !== 'maintain' || Math.abs(changeKg) <= 1,
    };
  }
  const total = goal.targetWeightKg - goal.startWeightKg;
  const fraction = total === 0 ? 1 : Math.max(0, Math.min(1, changeKg / total));
  const isTowardGoal = goal.goalType === 'lose' ? changeKg <= 0 : changeKg >= 0;
  return {
    kind: 'progress',
    changeKg,
    remainingKg: round2(goal.targetWeightKg - latest.kg),
    fraction,
    isTowardGoal,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
