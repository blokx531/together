import { Lock, Plus } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { describePortion, totalsOf, type MealSlot } from '../domain/calories';
import { MEAL_LABELS, type MealItem } from '../domain/types';

const kcalFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

interface MealCardProps {
  slot: MealSlot;
  /** Null for read-only (partner) view. */
  onAdd: (() => void) | null;
  onOpenItem: ((item: MealItem) => void) | null;
}

export function MealCard({ slot, onAdd, onOpenItem }: MealCardProps) {
  const title = slot.mealType === 'custom' ? slot.customLabel : MEAL_LABELS[slot.mealType];
  const items = slot.meal?.items ?? [];
  const totals = totalsOf(items);
  return (
    <section aria-label={title} className="rounded-card border border-line bg-surface shadow-card">
      <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-1">
        <h2 className="flex items-center gap-1.5 font-semibold">
          {title}
          {slot.meal?.visibility === 'private' ? (
            <Lock className="size-3.5 text-ink-subtle" aria-label="Private" />
          ) : null}
        </h2>
        <span className="text-sm text-ink-muted tabular-nums">
          {items.length > 0 ? `${kcalFormat.format(totals.kcal)} kcal` : ''}
        </span>
      </header>
      {items.length > 0 ? (
        <ul className="px-2">
          {items.map((item) => {
            const content = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {item.foodName}
                    {item.provenance === 'estimated' ? (
                      <span className="ml-1.5 rounded bg-warning-soft px-1 text-xs text-warning">
                        est.
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-sm text-ink-muted">
                    {describePortion(item)}
                  </span>
                </span>
                <span className="text-sm tabular-nums">{kcalFormat.format(item.kcal)}</span>
              </>
            );
            return (
              <li key={item.id} className="border-t border-line first:border-t-0">
                {onOpenItem ? (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenItem(item);
                    }}
                    className="flex min-h-12 w-full items-center gap-3 px-2 py-2 text-left hover:bg-surface-2"
                  >
                    {content}
                  </button>
                ) : (
                  <div className="flex min-h-12 items-center gap-3 px-2 py-2">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {onAdd ? (
        <div className="px-2 pb-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus className="size-4" aria-hidden />}
            onClick={onAdd}
            aria-label={`Add food to ${title}`}
          >
            Add
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="px-4 pb-3 text-sm text-ink-subtle">Nothing shared</p>
      ) : (
        <div className="pb-1" />
      )}
    </section>
  );
}
