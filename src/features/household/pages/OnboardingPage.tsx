import { useState, type SubmitEvent } from 'react';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Button } from '@/shared/ui/Button';
import { FormError, TextField } from '@/shared/ui/Field';
import { AcceptInvitation } from '../components/AcceptInvitation';
import { createHousehold } from '../data/householdApi';
import { clearPendingInvite, readPendingInvite } from '../pendingInvite';

interface OnboardingPageProps {
  displayName: string;
  onJoined: () => void;
  onSignOut: () => void;
}

const DEFAULT_HOUSEHOLD_NAME = 'Our home';

export function OnboardingPage({ displayName, onJoined, onSignOut }: OnboardingPageProps) {
  const [pendingToken, setPendingToken] = useState(readPendingInvite);
  const [name, setName] = useState(DEFAULT_HOUSEHOLD_NAME);
  const create = useAsyncAction(createHousehold);

  const onCreate = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await create.run(name.trim());
    if (result?.ok) onJoined();
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="mb-6 text-sm font-semibold tracking-wide text-accent uppercase">Together</p>
      <h1 className="text-3xl font-semibold tracking-tight">Hi {displayName}</h1>
      {pendingToken ? (
        <AcceptInvitation
          token={pendingToken}
          onJoined={() => {
            clearPendingInvite();
            onJoined();
          }}
          onDiscard={() => {
            clearPendingInvite();
            setPendingToken(null);
          }}
        />
      ) : (
        <>
          <p className="mt-2 mb-8 text-ink-muted">
            Create a shared space for the two of you. You will get an invite link for your partner
            next. If your partner already created one, ask them for their invite link and open it on
            this device.
          </p>
          <form onSubmit={(event) => void onCreate(event)} className="flex flex-col gap-4">
            <TextField
              label="Name of your shared space"
              required
              maxLength={60}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
            <FormError message={create.error?.message} />
            <Button type="submit" isLoading={create.isPending} fullWidth>
              Create our space
            </Button>
          </form>
        </>
      )}
      <Button variant="ghost" className="mt-8 self-center" onClick={onSignOut}>
        Sign out
      </Button>
    </main>
  );
}
