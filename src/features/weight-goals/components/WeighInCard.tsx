import { useState, type SubmitEvent } from 'react';
import { parseLocalDate, type LocalDate } from '@/shared/lib/localDate';
import { newRequestId } from '@/shared/lib/requestId';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FormError, TextField } from '@/shared/ui/Field';
import { useToast } from '@/shared/ui/Toast';
import { recordWeight, type WeighInRecord } from '../data/weightApi';
import { isPossibleOutlier } from '../domain/projection';

const MIN_KG = 20;
const MAX_KG = 350;

export function parseKg(input: string): number | null {
  const match = /^(\d{2,3})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const value = Number(input.trim());
  return value >= MIN_KG && value <= MAX_KG ? value : null;
}

interface WeighInCardProps {
  today: LocalDate;
  history: readonly WeighInRecord[];
  onSaved: () => void;
}

export function WeighInCard({ today, history, onSaved }: WeighInCardProps) {
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [kgInput, setKgInput] = useState('');
  const [requestId, setRequestId] = useState(newRequestId);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const save = useAsyncAction(recordWeight);
  const existing = history.find((entry) => entry.date === date);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const kg = parseKg(kgInput);
    if (kg === null) {
      setError(`Enter your weight in kg, between ${MIN_KG} and ${MAX_KG} (up to 2 decimals).`);
      return;
    }
    setError(null);
    if (!needsConfirmation && isPossibleOutlier({ date, kg }, history)) {
      setNeedsConfirmation(true);
      return;
    }
    const result = await save.run({ requestId, date, kg, note: '' });
    if (result?.ok) {
      toast.show(existing ? 'Weigh-in corrected' : 'Weigh-in saved', { tone: 'success' });
      setKgInput('');
      setNeedsConfirmation(false);
      setRequestId(newRequestId());
      onSaved();
    }
  };

  return (
    <Card title="Weigh-in">
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Weight (kg)"
            inputMode="decimal"
            placeholder="e.g. 68.4"
            value={kgInput}
            error={error ?? undefined}
            onChange={(event) => {
              setKgInput(event.target.value);
              setNeedsConfirmation(false);
            }}
          />
          <TextField
            label="Date"
            type="date"
            max={today}
            value={date}
            hint={existing ? `Replaces ${existing.kg} kg (history is kept)` : undefined}
            onChange={(event) => {
              const parsed = parseLocalDate(event.target.value);
              if (parsed) setDate(parsed);
            }}
          />
        </div>
        {needsConfirmation ? (
          <p role="alert" className="rounded-control bg-warning-soft px-3 py-2 text-sm">
            That is quite different from your last weigh-in. If it is right, save again to confirm.
          </p>
        ) : null}
        <FormError message={save.error?.message} />
        <Button type="submit" isLoading={save.isPending} className="self-start">
          {needsConfirmation ? 'Yes, save it' : 'Save weigh-in'}
        </Button>
        <p className="text-xs text-ink-subtle">
          Weekly, same time of day, gives the clearest trend.
        </p>
      </form>
    </Card>
  );
}
