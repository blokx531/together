import { Download, LogOut } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { describeAuthError, signOut, updatePassword } from '@/features/auth';
import {
  InvitePartnerCard,
  renameHousehold,
  updateProfile,
  useHousehold,
  type Visibility,
} from '@/features/household';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FormError, SelectField, TextField } from '@/shared/ui/Field';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useToast } from '@/shared/ui/Toast';
import { exportMyData } from './data/exportData';

const MIN_PASSWORD_LENGTH = 8;

function supportedTimeZones(current: string): string[] {
  const zones = Intl.supportedValuesOf('timeZone');
  return zones.includes(current) ? zones : [current, ...zones];
}

function ProfileCard() {
  const household = useHousehold();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(household.me.displayName);
  const [timeZone, setTimeZone] = useState(household.timeZone);
  const [mealVisibility, setMealVisibility] = useState<Visibility>(household.defaultMealVisibility);
  const save = useAsyncAction(updateProfile);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await save.run(household.me.userId, {
      displayName: displayName.trim(),
      timeZone,
      defaultMealVisibility: mealVisibility,
    });
    if (result?.ok) {
      toast.show('Profile saved', { tone: 'success' });
      household.reload();
    }
  };

  return (
    <Card title="Your profile">
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
        <TextField
          label="Name"
          required
          maxLength={40}
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
          }}
        />
        <SelectField
          label="Time zone"
          hint="Decides which day a meal, weigh-in or expense belongs to."
          value={timeZone}
          onChange={(event) => {
            setTimeZone(event.target.value);
          }}
        >
          {supportedTimeZones(timeZone).map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace(/_/g, ' ')}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="New meals are"
          hint="You can change this for any meal."
          value={mealVisibility}
          onChange={(event) => {
            setMealVisibility(event.target.value === 'private' ? 'private' : 'household');
          }}
        >
          <option value="household">Shared with your partner</option>
          <option value="private">Private to you</option>
        </SelectField>
        <FormError message={save.error?.message} />
        <Button type="submit" isLoading={save.isPending} className="self-start">
          Save profile
        </Button>
      </form>
    </Card>
  );
}

function HouseholdCard() {
  const household = useHousehold();
  const toast = useToast();
  const [name, setName] = useState(household.householdName);
  const rename = useAsyncAction(renameHousehold);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await rename.run(household.householdId, name.trim());
    if (result?.ok) {
      toast.show('Name updated', { tone: 'success' });
      household.reload();
    }
  };

  return (
    <Card title="Shared space">
      <div className="mb-4 flex flex-col gap-3">
        {[household.me, household.partner].map((member) =>
          member ? (
            <div key={member.userId} className="flex items-center gap-3">
              <Avatar name={member.displayName} tone={member.tone} decorative />
              <span className="font-medium">{member.displayName}</span>
              {member.tone === 'me' ? <span className="text-sm text-ink-muted">(you)</span> : null}
            </div>
          ) : null,
        )}
      </div>
      <form onSubmit={(event) => void onSubmit(event)} className="flex items-end gap-2">
        <div className="flex-1">
          <TextField
            label="Name"
            required
            maxLength={60}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </div>
        <Button type="submit" variant="secondary" isLoading={rename.isPending}>
          Rename
        </Button>
      </form>
      <FormError message={rename.error?.message} />
    </Card>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const change = useAsyncAction(updatePassword);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setValidationError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setValidationError(null);
    const result = await change.run(password);
    if (result?.ok) {
      setPassword('');
      toast.show('Password changed', { tone: 'success' });
    }
  };

  return (
    <Card title="Password">
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3">
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
        <FormError
          message={validationError ?? (change.error ? describeAuthError(change.error) : null)}
        />
        <Button
          type="submit"
          variant="secondary"
          isLoading={change.isPending}
          className="self-start"
        >
          Change password
        </Button>
      </form>
    </Card>
  );
}

function ExportCard() {
  const toast = useToast();
  const exportAction = useAsyncAction(exportMyData);
  const onExport = async () => {
    const result = await exportAction.run();
    if (!result?.ok) return;
    const json = JSON.stringify(result.value, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `together-export-${result.value.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.show('Export downloaded', { tone: 'success' });
  };
  return (
    <Card title="Your data">
      <p className="mb-3 text-sm text-ink-muted">
        Download everything you can see (your records and what your partner shares) as a JSON file.
        The free database plan has no backups, so keep an occasional copy somewhere private. Money
        has a CSV export on the Money page.
      </p>
      <FormError message={exportAction.error?.message} />
      <Button
        variant="secondary"
        icon={<Download className="size-4" aria-hidden />}
        isLoading={exportAction.isPending}
        onClick={() => void onExport()}
      >
        Export my data
      </Button>
    </Card>
  );
}

function DataSourcesCard() {
  return (
    <Card title="About the food data">
      <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-ink-muted">
        <li>
          Indian dishes: Katori Indian food nutrition dataset,{' '}
          <a
            href="https://getkatori.com/data"
            className="text-accent underline"
            rel="noreferrer"
            target="_blank"
          >
            getkatori.com/data
          </a>{' '}
          (CC BY 4.0).
        </li>
        <li>
          Other foods: McCance and Widdowson&apos;s Composition of Foods Integrated Dataset 2021.
          Contains public sector information licensed under the Open Government Licence v3.0.
        </li>
        <li>
          Values are typical averages. Home cooking, oil and portions vary, so calorie numbers are
          estimates.
        </li>
      </ul>
    </Card>
  );
}

export function SettingsPage() {
  const household = useHousehold();
  const signOutAction = useAsyncAction(signOut);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-4">
        <ProfileCard />
        <HouseholdCard />
        {household.partner ? null : <InvitePartnerCard />}
        <PasswordCard />
        <ExportCard />
        <DataSourcesCard />
        <FormError message={signOutAction.error?.message} />
        <Button
          variant="secondary"
          icon={<LogOut className="size-4" aria-hidden />}
          isLoading={signOutAction.isPending}
          onClick={() => void signOutAction.run()}
          className="self-start"
        >
          Sign out
        </Button>
      </div>
    </>
  );
}
