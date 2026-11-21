import { describe, expect, it } from 'vitest';
import type { LocalDate } from '@/shared/lib/localDate';
import {
  describePortion,
  kcalForQuantity,
  mealSlots,
  normalizeFoodQuery,
  totalsOf,
} from './calories';
import type { Meal, MealItem } from './types';

function item(partial: Partial<MealItem>): MealItem {
  return {
    id: crypto.randomUUID(),
    foodId: null,
    foodName: 'Roti',
    foodVariant: null,
    sourceLabel: 'Katori',
    provenance: 'derived',
    basisUnit: 'g',
    quantity: 40,
    servingLabel: null,
    servingCount: null,
    kcal: 102,
    proteinG: 4,
    carbsG: 21.6,
    fatG: 0.8,
    ...partial,
  };
}

describe('kcalForQuantity', () => {
  it('scales per-100 g values', () => {
    expect(kcalForQuantity({ basisAmount: 100, kcalPerBasis: 255 }, 80)).toBe(204);
    expect(kcalForQuantity({ basisAmount: 100, kcalPerBasis: 121 }, 150)).toBe(181.5);
  });
  it('scales per-serving values', () => {
    expect(kcalForQuantity({ basisAmount: 1, kcalPerBasis: 120 }, 2.5)).toBe(300);
  });
});

describe('totalsOf', () => {
  it('sums calories and macros, flags estimates', () => {
    const totals = totalsOf([
      item({}),
      item({ kcal: 181.5, proteinG: 7, carbsG: 20, fatG: 5, provenance: 'estimated' }),
    ]);
    expect(totals).toEqual({
      kcal: 284,
      proteinG: 11,
      carbsG: 41.6,
      fatG: 5.8,
      hasEstimates: true,
    });
  });
  it('withholds macro totals when any item lacks them', () => {
    expect(totalsOf([item({}), item({ proteinG: null })]).proteinG).toBeNull();
  });
  it('is zero for an empty day', () => {
    expect(totalsOf([])).toEqual({
      kcal: 0,
      proteinG: null,
      carbsG: null,
      fatG: null,
      hasEstimates: false,
    });
  });
});

describe('describePortion', () => {
  it('prefers the serving the user chose', () => {
    expect(
      describePortion(
        item({ servingLabel: '1 medium roti (40 g)', servingCount: 2, quantity: 80 }),
      ),
    ).toBe('2 × 1 medium roti (40 g)');
    expect(describePortion(item({ servingLabel: '1 katori (150 g)', servingCount: 1 }))).toBe(
      '1 katori (150 g)',
    );
    expect(describePortion(item({ quantity: 85 }))).toBe('85 g');
    expect(describePortion(item({ basisUnit: 'serving', quantity: 1 }))).toBe('1 serving');
  });
});

describe('mealSlots', () => {
  it('always shows the four standard meals, then custom ones', () => {
    const meal: Meal = {
      id: 'm',
      ownerId: 'u',
      date: '2026-11-21' as LocalDate,
      mealType: 'custom',
      customLabel: 'Pre-workout',
      visibility: 'household',
      items: [],
    };
    expect(mealSlots([meal]).map((slot) => slot.key)).toEqual([
      'breakfast',
      'lunch',
      'dinner',
      'snacks',
      'custom:Pre-workout',
    ]);
  });
});

describe('normalizeFoodQuery', () => {
  it('maps spellings and plurals', () => {
    expect(normalizeFoodQuery('Daal Tadka')).toEqual(['dal', 'tadka']);
    expect(normalizeFoodQuery('2 rotis!')).toEqual(['2', 'roti']);
  });
});
