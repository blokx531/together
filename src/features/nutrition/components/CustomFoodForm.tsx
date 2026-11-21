import { useState, type SubmitEvent } from 'react';
import { useHousehold } from '@/features/household';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Button } from '@/shared/ui/Button';
import { FormError, TextField } from '@/shared/ui/Field';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { createCustomFood } from '../data/nutritionApi';
import type { Food } from '../domain/types';

type Basis = 'per100g' | 'perServing';

function optionalMacro(input: string): number | null | 'invalid' {
  if (input.trim() === '') return null;
  const value = Number(input);
  return Number.isFinite(value) && value >= 0 && value <= 1000 ? value : 'invalid';
}

/** Create a food from a nutrition label (measured) or your own estimate. */
export function CustomFoodForm({
  initialName,
  onCreated,
}: {
  initialName: string;
  onCreated: (food: Food) => void;
}) {
  const household = useHousehold();
  const [name, setName] = useState(initialName);
  const [basis, setBasis] = useState<Basis>('per100g');
  const [kcalInput, setKcalInput] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  const [servingGrams, setServingGrams] = useState('');
  const [source, setSource] = useState<'measured' | 'estimated'>('measured');
  const [isShared, setIsShared] = useState(household.partner !== null);
  const [error, setError] = useState<string | null>(null);
  const create = useAsyncAction(createCustomFood);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const kcal = Number(kcalInput);
    const macros = [optionalMacro(protein), optionalMacro(carbs), optionalMacro(fat)] as const;
    const maxKcal = basis === 'per100g' ? 900 : 5000;
    if (name.trim() === '') {
      setError('Give the food a name.');
      return;
    }
    if (!Number.isFinite(kcal) || kcalInput.trim() === '' || kcal < 0 || kcal > maxKcal) {
      {
        setError(
          basis === 'per100g'
            ? 'Calories per 100 g must be between 0 and 900.'
            : 'Calories per serving must be between 0 and 5000.',
        );
        return;
      }
    }
    if (macros.includes('invalid')) {
      setError('Macros must be numbers in grams.');
      return;
    }
    let serving: { label: string; amount: number } | null = null;
    if (basis === 'per100g' && servingLabel.trim() !== '') {
      const grams = Number(servingGrams);
      if (!Number.isFinite(grams) || grams <= 0 || grams > 5000) {
        setError('Give the serving a weight in grams.');
        return;
      }
      serving = { label: `${servingLabel.trim()} (${grams} g)`, amount: grams };
    }
    setError(null);
    const [p, c, f] = macros;
    const result = await create.run({
      ownerId: household.me.userId,
      householdId: isShared ? household.householdId : null,
      name: name.trim(),
      basisUnit: basis === 'per100g' ? 'g' : 'serving',
      kcalPerBasis: kcal,
      proteinPerBasis: p === 'invalid' ? null : p,
      carbsPerBasis: c === 'invalid' ? null : c,
      fatPerBasis: f === 'invalid' ? null : f,
      provenance: source,
      serving,
    });
    if (result?.ok) onCreated(result.value);
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
      <TextField
        label="Food name"
        maxLength={80}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <SegmentedControl
        label="Values are"
        options={[
          { value: 'per100g', label: 'Per 100 g' },
          { value: 'perServing', label: 'Per serving' },
        ]}
        value={basis}
        onChange={setBasis}
      />
      <TextField
        label={basis === 'per100g' ? 'Calories per 100 g' : 'Calories per serving'}
        inputMode="decimal"
        value={kcalInput}
        onChange={(event) => {
          setKcalInput(event.target.value);
        }}
      />
      <div className="grid grid-cols-3 gap-3">
        <TextField
          label="Protein g"
          inputMode="decimal"
          value={protein}
          onChange={(event) => {
            setProtein(event.target.value);
          }}
        />
        <TextField
          label="Carbs g"
          inputMode="decimal"
          value={carbs}
          onChange={(event) => {
            setCarbs(event.target.value);
          }}
        />
        <TextField
          label="Fat g"
          inputMode="decimal"
          value={fat}
          onChange={(event) => {
            setFat(event.target.value);
          }}
        />
      </div>
      {basis === 'per100g' ? (
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <TextField
            label="Usual serving (optional)"
            placeholder="1 piece"
            value={servingLabel}
            onChange={(event) => {
              setServingLabel(event.target.value);
            }}
          />
          <TextField
            label="Grams"
            inputMode="decimal"
            value={servingGrams}
            onChange={(event) => {
              setServingGrams(event.target.value);
            }}
          />
        </div>
      ) : null}
      <SegmentedControl
        label="Where the numbers come from"
        options={[
          { value: 'measured', label: 'Nutrition label' },
          { value: 'estimated', label: 'My estimate' },
        ]}
        value={source}
        onChange={setSource}
      />
      {household.partner ? (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-accent"
            checked={isShared}
            onChange={(event) => {
              setIsShared(event.target.checked);
            }}
          />
          Let {household.partner.displayName} use this food too
        </label>
      ) : null}
      <FormError message={error ?? create.error?.message} />
      <Button type="submit" isLoading={create.isPending} fullWidth>
        Save food
      </Button>
    </form>
  );
}
