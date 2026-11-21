import { Minus, Plus } from 'lucide-react';
import { IconButton } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/Field';
import { UNIT_SYMBOL } from '../domain/calories';
import type { BasisUnit, FoodServing } from '../domain/types';

export type Portion =
  | { mode: 'serving'; servingIndex: number; count: number }
  | { mode: 'amount'; amountInput: string };

const HALF = 0.5;
const MAX_COUNT = 50;
const MAX_AMOUNT = 10_000;

/**
 * Serving steps: whole servings above one (2 rotis, 3 idlis) and a half serving below one
 * ("half plate"). 0.5 → 1 → 2 → 3 going up; 3 → 2 → 1 → 0.5 going down.
 */
export function stepCount(count: number, direction: 'up' | 'down'): number {
  if (direction === 'up') return Math.min(MAX_COUNT, count < 1 ? 1 : count + 1);
  return count > 1 ? Math.max(1, count - 1) : HALF;
}

/** Quantity in the food's basis unit, or null when the input is not a valid amount. */
export function portionQuantity(portion: Portion, servings: readonly FoodServing[]): number | null {
  if (portion.mode === 'serving') {
    const serving = servings[portion.servingIndex];
    return serving && portion.count > 0
      ? Math.round(serving.amount * portion.count * 100) / 100
      : null;
  }
  const value = Number(portion.amountInput);
  return Number.isFinite(value) && value > 0 && value <= MAX_AMOUNT
    ? Math.round(value * 100) / 100
    : null;
}

export function defaultPortion(servings: readonly FoodServing[], basisUnit: BasisUnit): Portion {
  if (servings.length > 0) return { mode: 'serving', servingIndex: 0, count: 1 };
  return { mode: 'amount', amountInput: basisUnit === 'serving' ? '1' : '100' };
}

interface PortionPickerProps {
  servings: readonly FoodServing[];
  basisUnit: BasisUnit;
  value: Portion;
  onChange: (portion: Portion) => void;
}

const countFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

export function PortionPicker({ servings, basisUnit, value, onChange }: PortionPickerProps) {
  const amountLabel = basisUnit === 'serving' ? 'Servings' : `Amount (${UNIT_SYMBOL[basisUnit]})`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Portion size">
        {servings.map((serving, index) => {
          const isSelected = value.mode === 'serving' && value.servingIndex === index;
          return (
            <button
              key={serving.label}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => {
                onChange({
                  mode: 'serving',
                  servingIndex: index,
                  count: value.mode === 'serving' ? value.count : 1,
                });
              }}
              className={`min-h-10 rounded-full border px-3 text-sm ${isSelected ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line'}`}
            >
              {serving.label}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={value.mode === 'amount'}
          onClick={() => {
            onChange({
              mode: 'amount',
              amountInput:
                value.mode === 'amount' ? value.amountInput : basisUnit === 'serving' ? '1' : '100',
            });
          }}
          className={`min-h-10 rounded-full border px-3 text-sm ${value.mode === 'amount' ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line'}`}
        >
          {basisUnit === 'serving' ? 'Number of servings' : `In ${UNIT_SYMBOL[basisUnit]}`}
        </button>
      </div>
      {value.mode === 'serving' ? (
        <div className="flex items-center gap-2">
          <IconButton
            label="Fewer"
            disabled={value.count <= HALF}
            onClick={() => {
              onChange({ ...value, count: stepCount(value.count, 'down') });
            }}
          >
            <Minus className="size-4" aria-hidden />
          </IconButton>
          <output
            aria-live="polite"
            className="min-w-16 text-center text-lg font-semibold tabular-nums"
          >
            {countFormat.format(value.count)} ×
          </output>
          <IconButton
            label="More"
            disabled={value.count >= MAX_COUNT}
            onClick={() => {
              onChange({ ...value, count: stepCount(value.count, 'up') });
            }}
          >
            <Plus className="size-4" aria-hidden />
          </IconButton>
        </div>
      ) : (
        <TextField
          label={amountLabel}
          inputMode="decimal"
          value={value.amountInput}
          onChange={(event) => {
            onChange({ mode: 'amount', amountInput: event.target.value });
          }}
        />
      )}
    </div>
  );
}
