import { describe, expect, it } from 'vitest';
import type { LocalDate } from '@/shared/lib/localDate';
import { ageInYears, energyBalance, estimateMaintenance, type EnergyProfile } from './energy';
import {
  goalProgress,
  isPossibleOutlier,
  KCAL_PER_KG,
  observedTrend,
  projectFromIntake,
} from './projection';

const d = (value: string) => value as LocalDate;

const profile: EnergyProfile = {
  formulaSex: 'female',
  birthDate: d('1996-03-10'),
  heightCm: 162,
  activityLevel: 'light',
  maintenanceMode: 'formula',
  maintenanceKcalManual: null,
  dailyIntakeTargetKcal: 1700,
  weightVisibility: 'private',
};

describe('energy balance', () => {
  it('matches the PRD example: 1,850 eaten vs 2,400 maintenance = 550 kcal deficit', () => {
    expect(energyBalance(1850, 2400, null)).toEqual({
      balanceKcal: 550,
      kind: 'deficit',
      remainingToTargetKcal: null,
    });
  });

  it('labels a surplus and keeps "remaining to target" separate from the deficit', () => {
    const result = energyBalance(2600, 2400, 1900);
    expect(result).toEqual({ balanceKcal: -200, kind: 'surplus', remainingToTargetKcal: -700 });
    expect(energyBalance(1500, 2400, 1900)).toMatchObject({
      balanceKcal: 900,
      remainingToTargetKcal: 400,
    });
  });
});

describe('maintenance estimate', () => {
  it('computes Mifflin-St Jeor × activity factor', () => {
    // BMR = 10×60 + 6.25×162 − 5×30 − 161 = 1301.5; × 1.375 = 1789.6
    const result = estimateMaintenance(profile, 60, d('2026-11-21'));
    expect(result).toMatchObject({ kind: 'formula', bmr: 1302, kcal: 1790, age: 30 });
  });

  it('uses the manual value when chosen', () => {
    expect(
      estimateMaintenance(
        { ...profile, maintenanceMode: 'manual', maintenanceKcalManual: 2100 },
        null,
        d('2026-11-21'),
      ),
    ).toEqual({
      kind: 'manual',
      kcal: 2100,
    });
  });

  it('lists missing inputs instead of guessing', () => {
    const result = estimateMaintenance(
      { ...profile, formulaSex: null, heightCm: null },
      null,
      d('2026-11-21'),
    );
    expect(result).toEqual({
      kind: 'missing',
      missing: ['a weigh-in', 'height', 'sex used by the formula'],
    });
  });

  it('computes age around birthdays', () => {
    expect(ageInYears(d('1996-03-10'), d('2026-03-09'))).toBe(29);
    expect(ageInYears(d('1996-03-10'), d('2026-03-10'))).toBe(30);
    expect(ageInYears(d('2000-02-29'), d('2026-02-28'))).toBe(25);
  });
});

describe('intake projection', () => {
  it('applies only complete days and never invents intake for missing days', () => {
    const projection = projectFromIntake(
      { date: d('2026-11-01'), kg: 80 },
      d('2026-11-04'),
      [
        { date: d('2026-11-01'), kcal: 1700, isComplete: true },
        { date: d('2026-11-02'), kcal: 500, isComplete: false },
      ],
      2470,
    );
    expect(projection.completeDays).toBe(1);
    expect(projection.totalDays).toBe(3);
    expect(projection.points.map((p) => p.kg)).toEqual([80, 79.9, 79.9, 79.9]);
    expect(770 / KCAL_PER_KG).toBeCloseTo(0.1);
  });
});

describe('observed trend', () => {
  it('needs at least 3 weigh-ins over 14 days', () => {
    expect(
      observedTrend([
        { date: d('2026-11-01'), kg: 80 },
        { date: d('2026-11-08'), kg: 79.5 },
      ]),
    ).toBeNull();
    expect(
      observedTrend([
        { date: d('2026-11-01'), kg: 80 },
        { date: d('2026-11-04'), kg: 79.8 },
        { date: d('2026-11-08'), kg: 79.5 },
      ]),
    ).toBeNull();
  });

  it('fits a weekly rate', () => {
    const trend = observedTrend([
      { date: d('2026-11-01'), kg: 80 },
      { date: d('2026-11-08'), kg: 79.5 },
      { date: d('2026-11-15'), kg: 79 },
    ]);
    expect(trend).toEqual({ kgPerWeek: -0.5, pointCount: 3, spanDays: 14 });
  });
});

describe('outliers and progress', () => {
  const history = [{ date: d('2026-11-14'), kg: 72 }];
  it('flags implausible jumps gently', () => {
    expect(isPossibleOutlier({ date: d('2026-11-15'), kg: 76 }, history)).toBe(true);
    expect(isPossibleOutlier({ date: d('2026-11-21'), kg: 73.2 }, history)).toBe(false);
    expect(isPossibleOutlier({ date: d('2026-11-21'), kg: 73.2 }, [])).toBe(false);
  });

  it('reports measured progress toward the goal', () => {
    const goal = { goalType: 'lose' as const, startWeightKg: 75, targetWeightKg: 70 };
    expect(goalProgress(goal, { date: d('2026-11-21'), kg: 73 })).toEqual({
      kind: 'progress',
      changeKg: -2,
      remainingKg: -3,
      fraction: 0.4,
      isTowardGoal: true,
    });
    expect(goalProgress(goal, { date: d('2026-11-21'), kg: 76 })).toMatchObject({
      isTowardGoal: false,
      fraction: 0,
    });
    expect(goalProgress(null, null)).toEqual({ kind: 'no-goal' });
    expect(goalProgress(goal, null)).toEqual({ kind: 'no-measurement' });
  });
});
