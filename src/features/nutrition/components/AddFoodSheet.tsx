import { ChevronLeft, Plus } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useHousehold } from '@/features/household';
import type { LocalDate } from '@/shared/lib/localDate';
import { newRequestId } from '@/shared/lib/requestId';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useResource } from '@/shared/lib/useResource';
import { Button } from '@/shared/ui/Button';
import { FormError, SelectField, TextField } from '@/shared/ui/Field';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Sheet } from '@/shared/ui/Sheet';
import { ErrorState, LoadingRows } from '@/shared/ui/States';
import { useToast } from '@/shared/ui/Toast';
import { logFood, recentFoods, searchFoods } from '../data/nutritionApi';
import { kcalForQuantity } from '../domain/calories';
import { MEAL_LABELS, MEAL_TYPES, type Food, type StandardMealType } from '../domain/types';
import { CustomFoodForm } from './CustomFoodForm';
import { defaultPortion, PortionPicker, portionQuantity, type Portion } from './PortionPicker';

interface AddFoodSheetProps {
  open: boolean;
  date: LocalDate;
  mealType: StandardMealType;
  onClose: () => void;
  onLogged: () => void;
}

export function AddFoodSheet({ open, date, mealType, onClose, onLogged }: AddFoodSheetProps) {
  return (
    <Sheet open={open} title="Add food" onClose={onClose}>
      {open ? (
        <AddFoodFlow date={date} initialMealType={mealType} onClose={onClose} onLogged={onLogged} />
      ) : null}
    </Sheet>
  );
}

type Step = { kind: 'search' } | { kind: 'portion'; food: Food } | { kind: 'custom' };

const kcalFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

function foodLabel(food: Food): string {
  return food.variant ? `${food.name} · ${food.variant}` : food.name;
}

function FoodRow({ food, onSelect }: { food: Food; onSelect: (food: Food) => void }) {
  const firstServing = food.servings[0];
  const perServing = firstServing
    ? `${kcalFormat.format(kcalForQuantity(food, firstServing.amount))} kcal per ${firstServing.label}`
    : null;
  const perBasis =
    food.basisUnit === 'serving'
      ? `${kcalFormat.format(food.kcalPerBasis)} kcal per serving`
      : `${kcalFormat.format(food.kcalPerBasis)} kcal / 100 ${food.basisUnit}`;
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => {
          onSelect(food);
        }}
        className="flex min-h-14 w-full flex-col justify-center px-1 py-2 text-left hover:bg-surface-2"
      >
        <span className="font-medium">{foodLabel(food)}</span>
        <span className="text-sm text-ink-muted">
          {perServing ?? perBasis}
          {food.isCustom ? ' · yours' : ''}
        </span>
      </button>
    </li>
  );
}

function FoodResults({ query, onSelect }: { query: string; onSelect: (food: Food) => void }) {
  const results = useResource(
    query.length >= 2 ? `food-search:${query}` : 'food-recent',
    (signal) => (query.length >= 2 ? searchFoods(query, signal) : recentFoods(signal)),
  );
  if (results.status === 'loading') return <LoadingRows rows={3} label="Searching foods" />;
  if (results.status === 'error')
    return <ErrorState error={results.error} onRetry={results.reload} />;
  if (results.data.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-ink-muted">
        {query.length >= 2
          ? `No foods match “${query}”.`
          : 'Search for a dish, e.g. roti, dal, poha.'}
      </p>
    );
  }
  return (
    <>
      {query.length < 2 ? (
        <h3 className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">Recent</h3>
      ) : null}
      <ul aria-label="Foods">
        {results.data.map((food) => (
          <FoodRow key={food.id} food={food} onSelect={onSelect} />
        ))}
      </ul>
    </>
  );
}

function AddFoodFlow({
  date,
  initialMealType,
  onClose,
  onLogged,
}: {
  date: LocalDate;
  initialMealType: StandardMealType;
  onClose: () => void;
  onLogged: () => void;
}) {
  const household = useHousehold();
  const toast = useToast();
  const [step, setStep] = useState<Step>({ kind: 'search' });
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const [mealType, setMealType] = useState(initialMealType);
  const [visibility, setVisibility] = useState(household.defaultMealVisibility);
  const [portion, setPortion] = useState<Portion>({ mode: 'amount', amountInput: '100' });
  const [requestId, setRequestId] = useState(newRequestId);
  const log = useAsyncAction(logFood);

  const selectFood = (food: Food) => {
    setPortion(defaultPortion(food.servings, food.basisUnit));
    setStep({ kind: 'portion', food });
  };

  if (step.kind === 'custom') {
    return (
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          icon={<ChevronLeft className="size-4" aria-hidden />}
          onClick={() => {
            setStep({ kind: 'search' });
          }}
        >
          Back to search
        </Button>
        <CustomFoodForm initialName={query} onCreated={selectFood} />
      </div>
    );
  }

  if (step.kind === 'portion') {
    const { food } = step;
    const quantity = portionQuantity(portion, food.servings);
    const serving = portion.mode === 'serving' ? food.servings[portion.servingIndex] : undefined;
    const onAdd = async () => {
      if (quantity === null) return;
      const result = await log.run({
        requestId,
        date,
        mealType,
        customLabel: '',
        visibility,
        foodId: food.id,
        quantity,
        servingLabel: serving?.label ?? null,
        servingCount: portion.mode === 'serving' ? portion.count : null,
      });
      if (result?.ok) {
        toast.show(`Added to ${MEAL_LABELS[mealType].toLowerCase()}`, { tone: 'success' });
        onLogged();
        setRequestId(newRequestId());
        setQuery('');
        setStep({ kind: 'search' });
      }
    };
    return (
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          icon={<ChevronLeft className="size-4" aria-hidden />}
          onClick={() => {
            setStep({ kind: 'search' });
          }}
        >
          Back
        </Button>
        <div>
          <p className="text-lg font-semibold">{foodLabel(food)}</p>
          <p className="text-xs text-ink-muted">
            {food.provenance === 'estimated'
              ? 'Your estimate'
              : food.provenance === 'measured'
                ? 'From a nutrition label'
                : `Typical values from ${food.sourceName}`}
            . Oil, ghee and portion size vary; adjust if yours differs.
          </p>
        </div>
        <PortionPicker
          servings={food.servings}
          basisUnit={food.basisUnit}
          value={portion}
          onChange={setPortion}
        />
        <p className="text-2xl font-semibold tabular-nums" aria-live="polite">
          {quantity === null ? '—' : `${kcalFormat.format(kcalForQuantity(food, quantity))} kcal`}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Meal"
            value={mealType}
            onChange={(event) => {
              const next = MEAL_TYPES.find((m) => m === event.target.value);
              if (next) setMealType(next);
            }}
          >
            {MEAL_TYPES.map((type) => (
              <option key={type} value={type}>
                {MEAL_LABELS[type]}
              </option>
            ))}
          </SelectField>
          {household.partner ? (
            <SegmentedControl
              label="Visible to"
              className="self-end"
              options={[
                { value: 'household', label: 'Both' },
                { value: 'private', label: 'Only me' },
              ]}
              value={visibility}
              onChange={setVisibility}
            />
          ) : null}
        </div>
        <FormError
          message={quantity === null ? 'Enter an amount greater than zero.' : log.error?.message}
        />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
          <Button
            className="flex-1"
            isLoading={log.isPending}
            disabled={quantity === null}
            onClick={() => void onAdd()}
          >
            Add to {MEAL_LABELS[mealType].toLowerCase()}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <TextField
        label="Search foods"
        hideLabel
        type="search"
        placeholder="Search: roti, dal tadka, poha…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      <FoodResults query={deferredQuery} onSelect={selectFood} />
      <Button
        variant="secondary"
        icon={<Plus className="size-4" aria-hidden />}
        onClick={() => {
          setStep({ kind: 'custom' });
        }}
      >
        Create a custom food
      </Button>
    </div>
  );
}
