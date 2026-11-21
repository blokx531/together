import { useState, type SubmitEvent } from 'react';
import { useHousehold } from '@/features/household';
import { parseLocalDate } from '@/shared/lib/localDate';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FormError, SelectField, TextField } from '@/shared/ui/Field';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { useToast } from '@/shared/ui/Toast';
import { saveEnergyProfile } from '../data/weightApi';
import {
  ACTIVITY_FACTORS,
  ACTIVITY_LABELS,
  type ActivityLevel,
  type EnergyProfile,
} from '../domain/energy';

const EMPTY_PROFILE: EnergyProfile = {
  formulaSex: null,
  birthDate: null,
  heightCm: null,
  activityLevel: null,
  maintenanceMode: 'manual',
  maintenanceKcalManual: null,
  dailyIntakeTargetKcal: null,
  weightVisibility: 'private',
};

function optionalInt(input: string, min: number, max: number): number | null | 'invalid' {
  if (input.trim() === '') return null;
  const value = Number(input);
  return Number.isInteger(value) && value >= min && value <= max ? value : 'invalid';
}

export function EnergyProfileCard({
  profile,
  onSaved,
}: {
  profile: EnergyProfile | null;
  onSaved: () => void;
}) {
  const household = useHousehold();
  const toast = useToast();
  const initial = profile ?? EMPTY_PROFILE;
  const [mode, setMode] = useState(initial.maintenanceMode);
  const [manual, setManual] = useState(initial.maintenanceKcalManual?.toString() ?? '');
  const [target, setTarget] = useState(initial.dailyIntakeTargetKcal?.toString() ?? '');
  const [sex, setSex] = useState(initial.formulaSex ?? '');
  const [birthDate, setBirthDate] = useState(initial.birthDate ?? '');
  const [height, setHeight] = useState(initial.heightCm?.toString() ?? '');
  const [activity, setActivity] = useState(initial.activityLevel ?? '');
  const [visibility, setVisibility] = useState(initial.weightVisibility);
  const [error, setError] = useState<string | null>(null);
  const save = useAsyncAction(saveEnergyProfile);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const manualKcal = optionalInt(manual, 800, 6000);
    const targetKcal = optionalInt(target, 800, 6000);
    const heightCm = height.trim() === '' ? null : Number(height);
    if (manualKcal === 'invalid' || targetKcal === 'invalid') {
      setError('Calories must be whole numbers between 800 and 6000.');
      return;
    }
    if (heightCm !== null && (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250)) {
      setError('Height must be between 100 and 250 cm.');
      return;
    }
    if (mode === 'manual' && manualKcal === null) {
      setError('Enter your maintenance calories, or switch to the estimate.');
      return;
    }
    setError(null);
    const result = await save.run(household.me.userId, {
      formulaSex: sex === 'male' || sex === 'female' ? sex : null,
      birthDate: parseLocalDate(birthDate),
      heightCm,
      activityLevel:
        (Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]).find((level) => level === activity) ??
        null,
      maintenanceMode: mode,
      maintenanceKcalManual: manualKcal,
      dailyIntakeTargetKcal: targetKcal,
      weightVisibility: visibility,
    });
    if (result?.ok) {
      toast.show('Saved', { tone: 'success' });
      onSaved();
    }
  };

  return (
    <Card title="Maintenance & targets">
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
        <SegmentedControl
          label="Maintenance calories"
          options={[
            { value: 'manual', label: 'I know my number' },
            { value: 'formula', label: 'Estimate it' },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === 'manual' ? (
          <TextField
            label="Maintenance (kcal/day)"
            inputMode="numeric"
            value={manual}
            onChange={(event) => {
              setManual(event.target.value);
            }}
          />
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              Uses the Mifflin-St Jeor equation with your latest weigh-in. It needs the inputs
              below; nothing is guessed.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Height (cm)"
                inputMode="decimal"
                value={height}
                onChange={(event) => {
                  setHeight(event.target.value);
                }}
              />
              <TextField
                label="Birth date"
                type="date"
                value={birthDate}
                onChange={(event) => {
                  setBirthDate(event.target.value);
                }}
              />
            </div>
            <SelectField
              label="Sex used by the formula"
              hint="The equation has separate male and female versions."
              value={sex}
              onChange={(event) => {
                setSex(event.target.value);
              }}
            >
              <option value="">Choose</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </SelectField>
            <SelectField
              label="Activity"
              value={activity}
              onChange={(event) => {
                setActivity(event.target.value);
              }}
            >
              <option value="">Choose</option>
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => (
                <option key={level} value={level}>
                  {ACTIVITY_LABELS[level]}
                </option>
              ))}
            </SelectField>
          </>
        )}
        <TextField
          label="Daily intake target (optional, kcal)"
          inputMode="numeric"
          hint="Separate from maintenance: what you aim to eat."
          value={target}
          onChange={(event) => {
            setTarget(event.target.value);
          }}
        />
        {household.partner ? (
          <SegmentedControl
            label="Weight and goal visibility"
            options={[
              { value: 'private', label: 'Only me' },
              { value: 'household', label: `Share with ${household.partner.displayName}` },
            ]}
            value={visibility}
            onChange={setVisibility}
          />
        ) : null}
        <FormError message={error ?? save.error?.message} />
        <Button type="submit" isLoading={save.isPending} className="self-start">
          Save
        </Button>
        <p className="text-xs text-ink-subtle">
          Height, birth date and sex are never shown to anyone else.
        </p>
      </form>
    </Card>
  );
}
