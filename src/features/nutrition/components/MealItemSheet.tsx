import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Button } from '@/shared/ui/Button';
import { FormError } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { deleteMealItem, updatePortion } from '../data/nutritionApi';
import type { MealItem } from '../domain/types';
import { PortionPicker, portionQuantity, type Portion } from './PortionPicker';

const kcalFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

interface MealItemSheetProps {
  item: MealItem | null;
  onClose: () => void;
  onChanged: () => void;
}

export function MealItemSheet({ item, onClose, onChanged }: MealItemSheetProps) {
  return (
    <Sheet open={item !== null} title={item?.foodName ?? 'Item'} onClose={onClose}>
      {item ? (
        <MealItemForm key={item.id} item={item} onClose={onClose} onChanged={onChanged} />
      ) : null}
    </Sheet>
  );
}

function MealItemForm({
  item,
  onClose,
  onChanged,
}: {
  item: MealItem;
  onClose: () => void;
  onChanged: () => void;
}) {
  // The logged serving (if any) becomes the only chip; values per unit come from the snapshot.
  const servings =
    item.servingLabel && item.servingCount
      ? [{ label: item.servingLabel, amount: item.quantity / item.servingCount }]
      : [];
  const [portion, setPortion] = useState<Portion>(
    servings.length > 0
      ? { mode: 'serving', servingIndex: 0, count: item.servingCount ?? 1 }
      : { mode: 'amount', amountInput: String(item.quantity) },
  );
  const save = useAsyncAction(updatePortion);
  const remove = useAsyncAction(deleteMealItem);
  const quantity = portionQuantity(portion, servings);
  const kcalPerUnit = item.quantity > 0 ? item.kcal / item.quantity : 0;

  const onSave = async () => {
    if (quantity === null) return;
    const result = await save.run(
      item.id,
      quantity,
      portion.mode === 'serving' ? (item.servingLabel ?? null) : null,
      portion.mode === 'serving' ? portion.count : null,
    );
    if (result?.ok) {
      onChanged();
      onClose();
    }
  };

  const onDelete = async () => {
    const result = await remove.run(item.id);
    if (result?.ok) {
      onChanged();
      onClose();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-muted">
        {item.provenance === 'estimated' ? 'Estimated value. ' : ''}Source: {item.sourceLabel}.
        Values were saved when you logged it.
      </p>
      <PortionPicker
        servings={servings}
        basisUnit={item.basisUnit}
        value={portion}
        onChange={setPortion}
      />
      <p className="text-2xl font-semibold tabular-nums">
        {quantity === null ? '—' : `${kcalFormat.format(kcalPerUnit * quantity)} kcal`}
      </p>
      <FormError message={save.error?.message ?? remove.error?.message} />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          icon={<Trash2 className="size-4" aria-hidden />}
          isLoading={remove.isPending}
          onClick={() => void onDelete()}
        >
          Remove
        </Button>
        <Button
          className="flex-1"
          disabled={quantity === null}
          isLoading={save.isPending}
          onClick={() => void onSave()}
        >
          Save portion
        </Button>
      </div>
    </div>
  );
}
