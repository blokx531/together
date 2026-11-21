import { createContext, use, useMemo, type ReactNode } from 'react';
import { useResource } from '@/shared/lib/useResource';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/States';
import { loadHouseholdSnapshot } from './data/householdApi';
import { buildHouseholdView, type HouseholdView } from './domain/householdView';
import { OnboardingPage } from './pages/OnboardingPage';

export interface HouseholdContextValue extends HouseholdView {
  /** Refetch names/membership after a change (e.g. partner joined, profile renamed). */
  reload: () => void;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

interface HouseholdGateProps {
  userId: string;
  onSignOut: () => void;
  children: ReactNode;
}

/** Loads the caller's household; shows onboarding until they create or join one. */
export function HouseholdGate({ userId, onSignOut, children }: HouseholdGateProps) {
  const resource = useResource(`household:${userId}`, loadHouseholdSnapshot);
  const result = useMemo(
    () =>
      resource.status === 'success'
        ? buildHouseholdView(userId, resource.data.profiles, resource.data.memberships)
        : null,
    [resource, userId],
  );
  const { reload } = resource;
  const value = useMemo<HouseholdContextValue | null>(
    () => (result?.kind === 'ready' ? { ...result.view, reload } : null),
    [result, reload],
  );

  if (resource.status === 'loading') {
    return <FullScreenMessage>Loading your space…</FullScreenMessage>;
  }
  if (resource.status === 'error') {
    return (
      <FullScreenMessage>
        <ErrorState error={resource.error} onRetry={resource.reload} />
        <Button variant="ghost" onClick={onSignOut}>
          Sign out
        </Button>
      </FullScreenMessage>
    );
  }
  if (result?.kind === 'profile-missing') {
    return (
      <FullScreenMessage>
        <p>Your profile could not be found. Try signing out and in again.</p>
        <Button variant="secondary" onClick={onSignOut}>
          Sign out
        </Button>
      </FullScreenMessage>
    );
  }
  if (result?.kind === 'no-household') {
    return (
      <OnboardingPage
        displayName={result.profile.displayName}
        onJoined={resource.reload}
        onSignOut={onSignOut}
      />
    );
  }
  if (!value) return null;
  return <HouseholdContext value={value}>{children}</HouseholdContext>;
}

function FullScreenMessage({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center text-ink-muted">
      {children}
    </main>
  );
}

export function useHousehold(): HouseholdContextValue {
  const value = use(HouseholdContext);
  if (!value) throw new Error('useHousehold must be used inside <HouseholdGate>.');
  return value;
}
