import type { BasisUnit, Food, Meal, MealItem, StandardMealType } from './types';
import { MEAL_TYPES } from './types';

/**
 * Same formula as the generated column meal_items.kcal: quantity / basis × kcal per basis, rounded to
 * 2 decimals. Used for previews before saving; stored totals always come from the database.
 */
export function kcalForQuantity(
  food: Pick<Food, 'basisAmount' | 'kcalPerBasis'>,
  quantity: number,
): number {
  return Math.round((quantity / food.basisAmount) * food.kcalPerBasis * 100) / 100;
}

export const UNIT_SYMBOL: Record<BasisUnit, string> = { g: 'g', ml: 'ml', serving: 'serving' };

/** "2 × 1 medium roti (40 g)" when logged by serving, otherwise "80 g". */
export function describePortion(
  item: Pick<MealItem, 'quantity' | 'basisUnit' | 'servingLabel' | 'servingCount'>,
): string {
  const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
  if (item.servingLabel && item.servingCount) {
    return item.servingCount === 1
      ? item.servingLabel
      : `${number.format(item.servingCount)} × ${item.servingLabel}`;
  }
  if (item.basisUnit === 'serving')
    return `${number.format(item.quantity)} ${item.quantity === 1 ? 'serving' : 'servings'}`;
  return `${number.format(item.quantity)} ${UNIT_SYMBOL[item.basisUnit]}`;
}

export interface Totals {
  kcal: number;
  /** Null when any item lacks macro data, so partial sums are never shown as complete. */
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  hasEstimates: boolean;
}

function sumNullable(values: readonly (number | null)[]): number | null {
  if (values.some((value) => value === null)) return null;
  return Math.round(values.reduce<number>((sum, value) => sum + (value ?? 0), 0) * 10) / 10;
}

export function totalsOf(items: readonly MealItem[]): Totals {
  return {
    kcal: Math.round(items.reduce((sum, item) => sum + item.kcal, 0)),
    proteinG: items.length === 0 ? null : sumNullable(items.map((i) => i.proteinG)),
    carbsG: items.length === 0 ? null : sumNullable(items.map((i) => i.carbsG)),
    fatG: items.length === 0 ? null : sumNullable(items.map((i) => i.fatG)),
    hasEstimates: items.some((item) => item.provenance === 'estimated'),
  };
}

export interface MealSlot {
  key: string;
  mealType: StandardMealType | 'custom';
  customLabel: string;
  meal: Meal | null;
}

/** The four standard slots (always shown) followed by any custom meals, in a stable order. */
export function mealSlots(meals: readonly Meal[]): MealSlot[] {
  const standard = MEAL_TYPES.map((mealType) => ({
    key: mealType,
    mealType,
    customLabel: '',
    meal: meals.find((meal) => meal.mealType === mealType) ?? null,
  }));
  const custom = meals
    .filter((meal) => meal.mealType === 'custom')
    .sort((a, b) => a.customLabel.localeCompare(b.customLabel))
    .map((meal) => ({
      key: `custom:${meal.customLabel}`,
      mealType: 'custom' as const,
      customLabel: meal.customLabel,
      meal,
    }));
  return [...standard, ...custom];
}

const SPELLING_VARIANTS: Record<string, string> = {
  daal: 'dal',
  dhal: 'dal',
  chapathi: 'chapati',
  chappati: 'chapati',
  biriyani: 'biryani',
  briyani: 'biryani',
  panner: 'paneer',
  sabji: 'sabzi',
  subzi: 'sabzi',
  subji: 'sabzi',
  dahi: 'curd',
  rotis: 'roti',
  chapatis: 'chapati',
  idlis: 'idli',
  dosas: 'dosa',
  samosas: 'samosa',
  eggs: 'egg',
  bananas: 'banana',
};

/** Lower-cases, trims and maps common spelling variants so "Daal" finds "dal". */
export function normalizeFoodQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => SPELLING_VARIANTS[token] ?? token);
}
