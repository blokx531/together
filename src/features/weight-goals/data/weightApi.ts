import { toAppError } from '@/shared/lib/appError';
import { parseLocalDate, type LocalDate } from '@/shared/lib/localDate';
import { getSupabase } from '@/shared/lib/supabase';
import type { ActivityLevel, EnergyProfile, FormulaSex } from '../domain/energy';
import type { DailyIntake, WeighIn } from '../domain/projection';

const MAX_WEIGH_INS = 520; // ten years of weekly weigh-ins

function requireDate(value: string): LocalDate {
  const date = parseLocalDate(value);
  if (!date) throw new Error(`Unexpected date: ${value}`);
  return date;
}

const ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
];

export async function loadEnergyProfile(signal: AbortSignal): Promise<EnergyProfile | null> {
  const { data, error } = await getSupabase()
    .from('energy_profiles')
    .select('*')
    .abortSignal(signal)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;
  return {
    formulaSex:
      data.formula_sex === 'male' || data.formula_sex === 'female'
        ? (data.formula_sex satisfies FormulaSex)
        : null,
    birthDate: data.birth_date ? requireDate(data.birth_date) : null,
    heightCm: data.height_cm,
    activityLevel: ACTIVITY_LEVELS.find((level) => level === data.activity_level) ?? null,
    maintenanceMode: data.maintenance_mode === 'formula' ? 'formula' : 'manual',
    maintenanceKcalManual: data.maintenance_kcal_manual,
    dailyIntakeTargetKcal: data.daily_intake_target_kcal,
    weightVisibility: data.weight_visibility === 'household' ? 'household' : 'private',
  };
}

/**
 * Update-then-insert rather than upsert: an upsert would also try to update `user_id`, which the
 * column grants (correctly) do not allow, and the request would be rejected.
 */
export async function saveEnergyProfile(userId: string, profile: EnergyProfile): Promise<void> {
  const values = {
    formula_sex: profile.formulaSex,
    birth_date: profile.birthDate,
    height_cm: profile.heightCm,
    activity_level: profile.activityLevel,
    maintenance_mode: profile.maintenanceMode,
    maintenance_kcal_manual: profile.maintenanceKcalManual,
    daily_intake_target_kcal: profile.dailyIntakeTargetKcal,
    weight_visibility: profile.weightVisibility,
  };
  const db = getSupabase();
  const updated = await db
    .from('energy_profiles')
    .update(values)
    .eq('user_id', userId)
    .select('user_id');
  if (updated.error) throw toAppError(updated.error);
  if (updated.data.length > 0) return;
  const inserted = await db.from('energy_profiles').insert({ user_id: userId, ...values });
  if (inserted.error) throw toAppError(inserted.error);
}

export interface WeighInRecord extends WeighIn {
  id: string;
  note: string | null;
}

export async function listWeighIns(userId: string, signal: AbortSignal): Promise<WeighInRecord[]> {
  const { data, error } = await getSupabase()
    .from('weight_entries')
    .select('id, local_date, weight_kg, note')
    .eq('user_id', userId)
    .order('local_date', { ascending: true })
    .limit(MAX_WEIGH_INS)
    .abortSignal(signal);
  if (error) throw toAppError(error);
  return data.map((row) => ({
    id: row.id,
    date: requireDate(row.local_date),
    kg: row.weight_kg,
    note: row.note,
  }));
}

export async function recordWeight(input: {
  requestId: string;
  date: LocalDate;
  kg: number;
  note: string;
}): Promise<void> {
  const { error } = await getSupabase().rpc('record_weight', {
    p_client_request_id: input.requestId,
    p_local_date: input.date,
    p_weight_kg: input.kg,
    p_note: input.note,
  });
  if (error) throw toAppError(error);
}

export async function deleteWeighIn(id: string): Promise<void> {
  const { error } = await getSupabase().from('weight_entries').delete().eq('id', id);
  if (error) throw toAppError(error);
}

export interface Goal {
  goalType: 'lose' | 'gain' | 'maintain';
  startWeightKg: number;
  startDate: LocalDate;
  targetWeightKg: number | null;
  targetDate: LocalDate | null;
  effectiveFrom: LocalDate;
}

/** The goal in force: the newest version (later effective date, then later creation). */
export async function loadCurrentGoal(userId: string, signal: AbortSignal): Promise<Goal | null> {
  const { data, error } = await getSupabase()
    .from('weight_goals')
    .select('*')
    .eq('user_id', userId)
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .abortSignal(signal)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;
  return {
    goalType:
      data.goal_type === 'gain' ? 'gain' : data.goal_type === 'maintain' ? 'maintain' : 'lose',
    startWeightKg: data.start_weight_kg,
    startDate: requireDate(data.start_date),
    targetWeightKg: data.target_weight_kg,
    targetDate: data.target_date ? requireDate(data.target_date) : null,
    effectiveFrom: requireDate(data.effective_from),
  };
}

export async function saveGoal(userId: string, goal: Goal): Promise<void> {
  const { error } = await getSupabase()
    .from('weight_goals')
    .insert({
      user_id: userId,
      goal_type: goal.goalType,
      start_weight_kg: goal.startWeightKg,
      start_date: goal.startDate,
      target_weight_kg: goal.goalType === 'maintain' ? null : goal.targetWeightKg,
      target_date: goal.targetDate,
      effective_from: goal.effectiveFrom,
    });
  if (error) throw toAppError(error);
}

export async function loadDailyIntake(
  from: LocalDate,
  to: LocalDate,
  signal: AbortSignal,
): Promise<DailyIntake[]> {
  const { data, error } = await getSupabase()
    .rpc('my_daily_intake', { p_from: from, p_to: to })
    .abortSignal(signal);
  if (error) throw toAppError(error);
  return data.map((row) => ({
    date: requireDate(row.local_date),
    kcal: row.kcal,
    isComplete: row.is_complete,
  }));
}

export async function isPartnerWeightShared(signal: AbortSignal): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('partner_weight_shared').abortSignal(signal);
  if (error) throw toAppError(error);
  return data;
}
