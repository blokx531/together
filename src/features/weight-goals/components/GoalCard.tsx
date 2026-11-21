import { useState, type SubmitEvent } from 'react';
import { useHousehold } from '@/features/household';
import { formatLocalDate, parseLocalDate, type LocalDate } from '@/shared/lib/localDate';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FormError, TextField } from '@/shared/ui/Field';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { useToast } from '@/shared/ui/Toast';
import { saveGoal, type Goal } from '../data/weightApi';
import { parseKg } from './WeighInCard';

interface GoalCardProps {
  goal: Goal | null;
  latestKg: number | null;
  today: LocalDate;
  onSaved: () => void;
}

export function GoalCard({ goal, latestKg, today, onSaved }: GoalCardProps) {
  const household = useHousehold();
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(goal === null);
  const [goalType, setGoalType] = useState<Goal['goalType']>(goal?.goalType ?? 'lose');
  const [startKg, setStartKg] = useState((goal?.startWeightKg ?? latestKg)?.toString() ?? '');
  const [targetKg, setTargetKg] = useState(goal?.targetWeightKg?.toString() ?? '');
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [error, setError] = useState<string | null>(null);
  const save = useAsyncAction(saveGoal);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const start = parseKg(startKg);
    const target = goalType === 'maintain' || targetKg.trim() === '' ? null : parseKg(targetKg);
    if (start === null) {
      setError('Enter a starting weight in kg.');
      return;
    }
    if (goalType !== 'maintain' && targetKg.trim() !== '' && target === null) {
      setError('Enter a target weight in kg.');
      return;
    }
    if (
      target !== null &&
      ((goalType === 'lose' && target >= start) || (goalType === 'gain' && target <= start))
    ) {
      setError(
        goalType === 'lose'
          ? 'A weight-loss target must be below the starting weight.'
          : 'A weight-gain target must be above the starting weight.',
      );
      return;
    }
    setError(null);
    const result = await save.run(household.me.userId, {
      goalType,
      startWeightKg: start,
      startDate: goal?.startDate ?? today,
      targetWeightKg: target,
      targetDate: parseLocalDate(targetDate),
      effectiveFrom: today,
    });
    if (result?.ok) {
      toast.show('Goal saved. Earlier goals stay in your history.', { tone: 'success' });
      setIsEditing(false);
      onSaved();
    }
  };

  if (!isEditing && goal) {
    return (
      <Card
        title="Goal"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsEditing(true);
            }}
          >
            Change
          </Button>
        }
      >
        <p className="font-medium">
          {goal.goalType === 'maintain'
            ? 'Maintain'
            : goal.goalType === 'lose'
              ? 'Lose weight'
              : 'Gain weight'}{' '}
          · from {goal.startWeightKg} kg
          {goal.targetWeightKg !== null ? ` to ${goal.targetWeightKg} kg` : ''}
        </p>
        <p className="text-sm text-ink-muted">
          Since {formatLocalDate(goal.startDate, 'day-month-year')}
          {goal.targetDate
            ? ` · aiming for ${formatLocalDate(goal.targetDate, 'day-month-year')}`
            : ''}
        </p>
      </Card>
    );
  }

  return (
    <Card title={goal ? 'Change goal' : 'Set a goal'}>
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
        <SegmentedControl
          label="Goal"
          options={[
            { value: 'lose', label: 'Lose' },
            { value: 'maintain', label: 'Maintain' },
            { value: 'gain', label: 'Gain' },
          ]}
          value={goalType}
          onChange={setGoalType}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Starting weight (kg)"
            inputMode="decimal"
            value={startKg}
            onChange={(event) => {
              setStartKg(event.target.value);
            }}
          />
          {goalType === 'maintain' ? null : (
            <TextField
              label="Target weight (kg)"
              inputMode="decimal"
              value={targetKg}
              onChange={(event) => {
                setTargetKg(event.target.value);
              }}
            />
          )}
        </div>
        {goalType === 'maintain' ? null : (
          <TextField
            label="Target date (optional)"
            type="date"
            min={today}
            hint="Slow and steady is usually more sustainable; this is not medical advice."
            value={targetDate}
            onChange={(event) => {
              setTargetDate(event.target.value);
            }}
          />
        )}
        <FormError message={error ?? save.error?.message} />
        <div className="flex gap-2">
          {goal ? (
            <Button
              variant="secondary"
              onClick={() => {
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
          ) : null}
          <Button type="submit" isLoading={save.isPending}>
            Save goal
          </Button>
        </div>
      </form>
    </Card>
  );
}
