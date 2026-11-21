import type { LocalDate } from '@/shared/lib/localDate';

export type BasisUnit = 'g' | 'ml' | 'serving';
export type Provenance = 'measured' | 'derived' | 'estimated';
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
export type StandardMealType = (typeof MEAL_TYPES)[number];
export type MealType = StandardMealType | 'custom';

export const MEAL_LABELS: Record<StandardMealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

export interface FoodServing {
  label: string;
  /** In the food's basis unit. */
  amount: number;
}

export interface Food {
  id: string;
  name: string;
  variant: string | null;
  sourceId: string;
  sourceName: string;
  isCustom: boolean;
  basisUnit: BasisUnit;
  basisAmount: number;
  kcalPerBasis: number;
  proteinPerBasis: number | null;
  carbsPerBasis: number | null;
  fatPerBasis: number | null;
  provenance: Provenance;
  servings: FoodServing[];
}

export interface MealItem {
  id: string;
  foodId: string | null;
  foodName: string;
  foodVariant: string | null;
  sourceLabel: string;
  provenance: Provenance;
  basisUnit: BasisUnit;
  quantity: number;
  servingLabel: string | null;
  servingCount: number | null;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface Meal {
  id: string;
  ownerId: string;
  date: LocalDate;
  mealType: MealType;
  customLabel: string;
  visibility: 'private' | 'household';
  items: MealItem[];
}
