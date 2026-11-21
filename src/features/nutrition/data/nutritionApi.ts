import { AppError, toAppError } from '@/shared/lib/appError';
import { parseLocalDate, type LocalDate } from '@/shared/lib/localDate';
import { getSupabase } from '@/shared/lib/supabase';
import type { Tables } from '@/shared/types/database';
import { normalizeFoodQuery } from '../domain/calories';
import type { BasisUnit, Food, Meal, MealItem, MealType, Provenance } from '../domain/types';

const SEARCH_LIMIT = 30;
const RECENT_ITEMS_SCANNED = 60;
const RECENT_FOODS_SHOWN = 12;

const FOOD_COLUMNS =
  'id, name, variant, source_id, owner_user_id, basis_unit, basis_amount, kcal_per_basis, protein_g_per_basis, carbs_g_per_basis, fat_g_per_basis, provenance, food_servings(label, amount, position), food_sources(name)';

function asBasisUnit(value: string): BasisUnit {
  if (value === 'g' || value === 'ml' || value === 'serving') return value;
  throw new Error(`Unexpected basis unit: ${value}`);
}

function asProvenance(value: string): Provenance {
  if (value === 'measured' || value === 'derived' || value === 'estimated') return value;
  throw new Error(`Unexpected provenance: ${value}`);
}

function asMealType(value: string): MealType {
  if (
    value === 'breakfast' ||
    value === 'lunch' ||
    value === 'dinner' ||
    value === 'snacks' ||
    value === 'custom'
  )
    return value;
  throw new Error(`Unexpected meal type: ${value}`);
}

type FoodRow = Pick<
  Tables<'foods'>,
  | 'id'
  | 'name'
  | 'variant'
  | 'source_id'
  | 'owner_user_id'
  | 'basis_unit'
  | 'basis_amount'
  | 'kcal_per_basis'
  | 'protein_g_per_basis'
  | 'carbs_g_per_basis'
  | 'fat_g_per_basis'
  | 'provenance'
> & {
  food_servings: { label: string; amount: number; position: number }[];
  food_sources: { name: string };
};

function toFood(row: FoodRow): Food {
  return {
    id: row.id,
    name: row.name,
    variant: row.variant,
    sourceId: row.source_id,
    sourceName: row.food_sources.name,
    isCustom: row.owner_user_id !== null,
    basisUnit: asBasisUnit(row.basis_unit),
    basisAmount: row.basis_amount,
    kcalPerBasis: row.kcal_per_basis,
    proteinPerBasis: row.protein_g_per_basis,
    carbsPerBasis: row.carbs_g_per_basis,
    fatPerBasis: row.fat_g_per_basis,
    provenance: asProvenance(row.provenance),
    servings: [...row.food_servings]
      .sort((a, b) => a.position - b.position)
      .map(({ label, amount }) => ({ label, amount })),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function searchFoods(query: string, signal: AbortSignal): Promise<Food[]> {
  const tokens = normalizeFoodQuery(query).filter((token) => !/^\d+$/.test(token));
  if (tokens.length === 0) return [];
  let request = getSupabase().from('foods').select(FOOD_COLUMNS).is('archived_at', null);
  for (const token of tokens) request = request.ilike('search_text', `%${escapeLike(token)}%`);
  const { data, error } = await request
    .order('name')
    .order('variant')
    .limit(SEARCH_LIMIT)
    .abortSignal(signal);
  if (error) throw toAppError(error);
  return data.map(toFood);
}

/** Foods the caller logged most recently, for one-tap re-logging. */
export async function recentFoods(signal: AbortSignal): Promise<Food[]> {
  const db = getSupabase();
  const { data: userData } = await db.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];
  const recent = await db
    .from('meal_items')
    .select('food_id, meals!inner(owner_user_id)')
    .eq('meals.owner_user_id', userId)
    .not('food_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(RECENT_ITEMS_SCANNED)
    .abortSignal(signal);
  if (recent.error) throw toAppError(recent.error);
  // `.not('food_id', 'is', null)` above narrows food_id to string.
  const ids = [...new Set(recent.data.map((row) => row.food_id))].slice(0, RECENT_FOODS_SHOWN);
  if (ids.length === 0) return [];
  const foods = await db.from('foods').select(FOOD_COLUMNS).in('id', ids).abortSignal(signal);
  if (foods.error) throw toAppError(foods.error);
  const byId = new Map(foods.data.map((row) => [row.id, toFood(row)]));
  return ids.map((id) => byId.get(id)).filter((food) => food !== undefined);
}

function toMealItem(row: Tables<'meal_items'>): MealItem {
  return {
    id: row.id,
    foodId: row.food_id,
    foodName: row.food_name,
    foodVariant: row.food_variant,
    sourceLabel: row.source_label,
    provenance: asProvenance(row.provenance),
    basisUnit: asBasisUnit(row.basis_unit),
    quantity: row.quantity,
    servingLabel: row.serving_label,
    servingCount: row.serving_count,
    kcal: row.kcal ?? 0,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
  };
}

export interface DayLog {
  meals: Meal[];
  isComplete: boolean;
}

/** One person's meals for a day. RLS returns the partner's shared meals only. */
export async function loadDay(
  ownerId: string,
  date: LocalDate,
  signal: AbortSignal,
): Promise<DayLog> {
  const db = getSupabase();
  const [meals, day] = await Promise.all([
    db
      .from('meals')
      .select('*, meal_items(*)')
      .eq('owner_user_id', ownerId)
      .eq('local_date', date)
      .abortSignal(signal),
    db
      .from('nutrition_days')
      .select('is_complete')
      .eq('owner_user_id', ownerId)
      .eq('local_date', date)
      .abortSignal(signal)
      .maybeSingle(),
  ]);
  if (meals.error) throw toAppError(meals.error);
  if (day.error) throw toAppError(day.error);
  return {
    isComplete: day.data?.is_complete ?? false,
    meals: meals.data.map((row) => {
      const mealDate = parseLocalDate(row.local_date);
      if (!mealDate) throw new Error(`Unexpected meal date: ${row.local_date}`);
      return {
        id: row.id,
        ownerId: row.owner_user_id,
        date: mealDate,
        mealType: asMealType(row.meal_type),
        customLabel: row.custom_label,
        visibility: row.visibility === 'private' ? 'private' : 'household',
        items: [...row.meal_items]
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map(toMealItem),
      };
    }),
  };
}

export interface LogFoodInput {
  requestId: string;
  date: LocalDate;
  mealType: MealType;
  customLabel: string;
  visibility: 'private' | 'household';
  foodId: string;
  quantity: number;
  servingLabel: string | null;
  servingCount: number | null;
}

export async function logFood(input: LogFoodInput): Promise<void> {
  const { error } = await getSupabase().rpc('log_food', {
    p_client_request_id: input.requestId,
    p_local_date: input.date,
    p_meal_type: input.mealType,
    p_custom_label: input.customLabel,
    p_visibility: input.visibility,
    p_food_id: input.foodId,
    p_quantity: input.quantity,
    p_serving_label: input.servingLabel ?? '',
    p_serving_count: input.servingCount ?? 1,
  });
  if (error) throw toAppError(error);
}

export async function updatePortion(
  itemId: string,
  quantity: number,
  servingLabel: string | null,
  servingCount: number | null,
): Promise<void> {
  const { data, error } = await getSupabase()
    .from('meal_items')
    .update({ quantity, serving_label: servingLabel, serving_count: servingCount })
    .eq('id', itemId)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('not_found', 'This item no longer exists.');
}

export async function deleteMealItem(itemId: string): Promise<void> {
  const { error } = await getSupabase().from('meal_items').delete().eq('id', itemId);
  if (error) throw toAppError(error);
}

export async function setMealVisibility(
  mealId: string,
  visibility: 'private' | 'household',
): Promise<void> {
  const { error } = await getSupabase().from('meals').update({ visibility }).eq('id', mealId);
  if (error) throw toAppError(error);
}

/** Copies every meal of `meals` to `targetDate`, same slots. One request id makes retries harmless. */
export async function copyMealsToDate(
  meals: readonly Meal[],
  targetDate: LocalDate,
  requestId: string,
): Promise<void> {
  const db = getSupabase();
  for (const meal of meals) {
    const { error } = await db.rpc('copy_meal', {
      p_source_meal_id: meal.id,
      p_target_date: targetDate,
      p_target_meal_type: meal.mealType,
      p_target_custom_label: meal.customLabel,
      p_request_id: requestId,
    });
    if (error) throw toAppError(error);
  }
}

export async function moveMeal(
  mealId: string,
  targetDate: LocalDate,
  mealType: MealType,
  customLabel: string,
): Promise<void> {
  const { error } = await getSupabase().rpc('move_meal', {
    p_meal_id: mealId,
    p_target_date: targetDate,
    p_target_meal_type: mealType,
    p_target_custom_label: customLabel,
  });
  if (error) throw toAppError(error);
}

export async function setDayComplete(date: LocalDate, isComplete: boolean): Promise<void> {
  const { error } = await getSupabase().rpc('set_day_complete', {
    p_local_date: date,
    p_is_complete: isComplete,
  });
  if (error) throw toAppError(error);
}

export interface CustomFoodInput {
  ownerId: string;
  householdId: string | null;
  name: string;
  basisUnit: BasisUnit;
  kcalPerBasis: number;
  proteinPerBasis: number | null;
  carbsPerBasis: number | null;
  fatPerBasis: number | null;
  provenance: 'measured' | 'estimated';
  serving: { label: string; amount: number } | null;
}

export async function createCustomFood(input: CustomFoodInput): Promise<Food> {
  const db = getSupabase();
  const { data, error } = await db
    .from('foods')
    .insert({
      source_id: 'user',
      owner_user_id: input.ownerId,
      household_id: input.householdId,
      name: input.name,
      basis_unit: input.basisUnit,
      basis_amount: input.basisUnit === 'serving' ? 1 : 100,
      kcal_per_basis: input.kcalPerBasis,
      protein_g_per_basis: input.proteinPerBasis,
      carbs_g_per_basis: input.carbsPerBasis,
      fat_g_per_basis: input.fatPerBasis,
      provenance: input.provenance,
    })
    .select('id')
    .single();
  if (error) throw toAppError(error);
  if (input.serving) {
    const serving = await db
      .from('food_servings')
      .insert({ food_id: data.id, label: input.serving.label, amount: input.serving.amount });
    if (serving.error) throw toAppError(serving.error);
  }
  const created = await db.from('foods').select(FOOD_COLUMNS).eq('id', data.id).single();
  if (created.error) throw toAppError(created.error);
  return toFood(created.data);
}
