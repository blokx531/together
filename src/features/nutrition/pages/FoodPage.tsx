import { CopyPlus, Target } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';
import { useHousehold } from '@/features/household';
import { EnergySummaryCard } from '@/features/weight-goals';
import { addDays, todayIn, type LocalDate } from '@/shared/lib/localDate';
import { newRequestId } from '@/shared/lib/requestId';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useResource } from '@/shared/lib/useResource';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { DateStepper } from '@/shared/ui/DateStepper';
import { FormError } from '@/shared/ui/Field';
import { PageHeader } from '@/shared/ui/PageHeader';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { ErrorState, LoadingRows } from '@/shared/ui/States';
import { useToast } from '@/shared/ui/Toast';
import { AddFoodSheet } from '../components/AddFoodSheet';
import { MealCard } from '../components/MealCard';
import { MealItemSheet } from '../components/MealItemSheet';
import { copyMealsToDate, loadDay, setDayComplete } from '../data/nutritionApi';
import { mealSlots, totalsOf } from '../domain/calories';
import type { MealItem, StandardMealType } from '../domain/types';

const kcalFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

function CopyPreviousDay({
  date,
  ownerId,
  onCopied,
}: {
  date: LocalDate;
  ownerId: string;
  onCopied: () => void;
}) {
  const previousDate = addDays(date, -1);
  const previous = useResource(`food-day:${ownerId}:${previousDate}`, (signal) =>
    loadDay(ownerId, previousDate, signal),
  );
  const [requestId] = useState(newRequestId);
  const copy = useAsyncAction(copyMealsToDate);
  const toast = useToast();
  if (previous.status !== 'success' || previous.data.meals.length === 0) return null;
  const onCopy = async () => {
    const result = await copy.run(previous.data.meals, date, requestId);
    if (result?.ok) {
      toast.show('Copied the previous day’s meals', { tone: 'success' });
      onCopied();
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        icon={<CopyPlus className="size-4" aria-hidden />}
        isLoading={copy.isPending}
        onClick={() => void onCopy()}
      >
        Same as the day before
      </Button>
      <FormError message={copy.error?.message} />
    </div>
  );
}

export function FoodPage() {
  const household = useHousehold();
  const today = todayIn(household.timeZone, new Date());
  const [date, setDate] = useState<LocalDate>(today);
  const [person, setPerson] = useState<'me' | 'partner'>('me');
  const [addingTo, setAddingTo] = useState<StandardMealType | null>(null);
  const [editing, setEditing] = useState<MealItem | null>(null);
  const viewer = person === 'partner' && household.partner ? household.partner : household.me;
  const isMine = viewer.userId === household.me.userId;
  const day = useResource(`food-day:${viewer.userId}:${date}`, (signal) =>
    loadDay(viewer.userId, date, signal),
  );
  const toggleComplete = useAsyncAction(setDayComplete);
  // Optimistic value for the "day complete" checkbox until the server confirms.
  const [pendingComplete, setPendingComplete] = useState<boolean | null>(null);

  return (
    <>
      <PageHeader
        title="Food"
        actions={
          <Link
            href="/food/progress"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-medium text-accent hover:bg-accent-soft"
          >
            <Target className="size-4" aria-hidden />
            Weight & goals
          </Link>
        }
      />
      <div className="flex flex-col gap-4">
        {household.partner ? (
          <SegmentedControl
            label="Whose diary"
            options={[
              { value: 'me', label: 'You' },
              { value: 'partner', label: household.partner.displayName },
            ]}
            value={person}
            onChange={setPerson}
          />
        ) : null}
        <div className="flex justify-center">
          <DateStepper value={date} today={today} onChange={setDate} />
        </div>

        {day.status === 'loading' ? <LoadingRows rows={4} label="Loading meals" /> : null}
        {day.status === 'error' ? <ErrorState error={day.error} onRetry={day.reload} /> : null}
        {day.status === 'success'
          ? (() => {
              const allItems = day.data.meals.flatMap((meal) => meal.items);
              const totals = totalsOf(allItems);
              return (
                <>
                  {isMine ? (
                    <EnergySummaryCard
                      date={date}
                      eatenKcal={totals.kcal}
                      isDayComplete={day.data.isComplete}
                    />
                  ) : (
                    <Card title={`${viewer.displayName}'s day`}>
                      <p className="text-2xl font-semibold tabular-nums">
                        {kcalFormat.format(totals.kcal)} kcal
                      </p>
                      <p className="text-sm text-ink-muted">
                        From meals {viewer.displayName} shares
                        {day.data.isComplete ? ' · day marked complete' : ' · may be incomplete'}.
                      </p>
                    </Card>
                  )}
                  {totals.proteinG !== null && totals.carbsG !== null && totals.fatG !== null ? (
                    <p className="text-center text-sm text-ink-muted">
                      Protein {totals.proteinG} g · Carbs {totals.carbsG} g · Fat {totals.fatG} g
                      {totals.hasEstimates ? ' · includes estimates' : ''}
                    </p>
                  ) : null}
                  {isMine && allItems.length === 0 ? (
                    <CopyPreviousDay date={date} ownerId={viewer.userId} onCopied={day.reload} />
                  ) : null}
                  {mealSlots(day.data.meals).map((slot) => (
                    <MealCard
                      key={slot.key}
                      slot={slot}
                      onAdd={
                        isMine && slot.mealType !== 'custom'
                          ? () => {
                              setAddingTo(slot.mealType === 'custom' ? null : slot.mealType);
                            }
                          : null
                      }
                      onOpenItem={isMine ? setEditing : null}
                    />
                  ))}
                  {isMine && allItems.length > 0 ? (
                    <label className="flex min-h-11 items-center gap-3 rounded-control bg-surface-2 px-4 text-sm">
                      <input
                        type="checkbox"
                        className="size-5 accent-accent"
                        checked={pendingComplete ?? day.data.isComplete}
                        disabled={toggleComplete.isPending}
                        onChange={(event) => {
                          const next = event.target.checked;
                          setPendingComplete(next);
                          void toggleComplete.run(date, next).then((result) => {
                            setPendingComplete(null);
                            if (result?.ok) day.reload();
                          });
                        }}
                      />
                      I logged everything I ate this day
                    </label>
                  ) : null}
                  <FormError message={toggleComplete.error?.message} />
                </>
              );
            })()
          : null}
      </div>
      <AddFoodSheet
        open={isMine && addingTo !== null}
        date={date}
        mealType={addingTo ?? 'lunch'}
        day={day}
        onClose={() => {
          setAddingTo(null);
        }}
      />
      <MealItemSheet
        item={editing}
        onClose={() => {
          setEditing(null);
        }}
        onChanged={day.reload}
      />
    </>
  );
}
