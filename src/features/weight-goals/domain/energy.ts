import { daysBetween, type LocalDate } from '@/shared/lib/localDate';

/**
 * Maintenance energy (TDEE) estimate: Mifflin-St Jeor BMR × activity factor.
 *   BMR (kcal/day) = 10 × weight(kg) + 6.25 × height(cm) − 5 × age(years) + s,  s = +5 (male), −161 (female)
 * The formula needs a sex term; the app asks for it explicitly and offers a manual value instead.
 * It is a population estimate (typically within ±10% for most people), never a measurement.
 */
export type FormulaSex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Mostly sitting, little exercise',
  light: 'Light exercise 1–3 days a week',
  moderate: 'Moderate exercise 3–5 days a week',
  active: 'Hard exercise 6–7 days a week',
  very_active: 'Very hard exercise or physical job',
};

const SEX_CONSTANT: Record<FormulaSex, number> = { male: 5, female: -161 };

export interface EnergyProfile {
  formulaSex: FormulaSex | null;
  birthDate: LocalDate | null;
  heightCm: number | null;
  activityLevel: ActivityLevel | null;
  maintenanceMode: 'formula' | 'manual';
  maintenanceKcalManual: number | null;
  dailyIntakeTargetKcal: number | null;
  weightVisibility: 'private' | 'household';
}

export function ageInYears(birthDate: LocalDate, on: LocalDate): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = on.split('-').map(Number);
  if (
    by === undefined ||
    bm === undefined ||
    bd === undefined ||
    y === undefined ||
    m === undefined ||
    d === undefined
  )
    return 0;
  const hadBirthday = m > bm || (m === bm && d >= bd);
  return y - by - (hadBirthday ? 0 : 1);
}

export type MaintenanceEstimate =
  | { kind: 'manual'; kcal: number }
  | { kind: 'formula'; kcal: number; bmr: number; factor: number; weightKg: number; age: number }
  | { kind: 'missing'; missing: string[] };

export function estimateMaintenance(
  profile: EnergyProfile | null,
  latestWeightKg: number | null,
  on: LocalDate,
): MaintenanceEstimate {
  if (!profile) return { kind: 'missing', missing: ['energy profile'] };
  if (profile.maintenanceMode === 'manual') {
    return profile.maintenanceKcalManual === null
      ? { kind: 'missing', missing: ['maintenance calories'] }
      : { kind: 'manual', kcal: profile.maintenanceKcalManual };
  }
  const missing: string[] = [];
  if (latestWeightKg === null) missing.push('a weigh-in');
  if (profile.heightCm === null) missing.push('height');
  if (profile.birthDate === null) missing.push('birth date');
  if (profile.formulaSex === null) missing.push('sex used by the formula');
  if (profile.activityLevel === null) missing.push('activity level');
  if (
    latestWeightKg === null ||
    profile.heightCm === null ||
    profile.birthDate === null ||
    profile.formulaSex === null ||
    profile.activityLevel === null
  ) {
    return { kind: 'missing', missing };
  }
  const age = ageInYears(profile.birthDate, on);
  const bmr =
    10 * latestWeightKg + 6.25 * profile.heightCm - 5 * age + SEX_CONSTANT[profile.formulaSex];
  const factor = ACTIVITY_FACTORS[profile.activityLevel];
  return {
    kind: 'formula',
    kcal: Math.round(bmr * factor),
    bmr: Math.round(bmr),
    factor,
    weightKg: latestWeightKg,
    age,
  };
}

export type BalanceKind = 'deficit' | 'surplus' | 'even';

export interface EnergyBalance {
  /** maintenance − eaten. Positive = deficit. Only meaningful when the day is fully logged. */
  balanceKcal: number;
  kind: BalanceKind;
  /** target − eaten; null without a target. Distinct from the deficit vs. maintenance. */
  remainingToTargetKcal: number | null;
}

/** The PRD example: eaten ≈ 1,850 with maintenance 2,400 → estimated 550 kcal deficit. */
export function energyBalance(
  eatenKcal: number,
  maintenanceKcal: number,
  targetKcal: number | null,
): EnergyBalance {
  const balanceKcal = Math.round(maintenanceKcal - eatenKcal);
  const kind: BalanceKind = balanceKcal > 0 ? 'deficit' : balanceKcal < 0 ? 'surplus' : 'even';
  return {
    balanceKcal,
    kind,
    remainingToTargetKcal: targetKcal === null ? null : Math.round(targetKcal - eatenKcal),
  };
}

export function weeksBetween(from: LocalDate, to: LocalDate): number {
  return daysBetween(from, to) / 7;
}
