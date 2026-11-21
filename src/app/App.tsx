import { Suspense } from 'react';
import { Redirect, Route, Switch } from 'wouter';
import { JoinPage, HouseholdGate, readPendingInvite } from '@/features/household';
import { SessionProvider, SignInPage, SignUpPage, signOut, useSession } from '@/features/auth';
import { envResult } from '@/shared/lib/supabase';
import { LoadingRows } from '@/shared/ui/States';
import { ToastProvider } from '@/shared/ui/Toast';
import { AppShell } from './AppShell';
import { ErrorBoundary } from './ErrorBoundary';
import { lazyPage } from './lazyPage';

const HomePage = lazyPage(() => import('@/features/dashboard/HomePage').then((m) => m.HomePage));
const MoneyPage = lazyPage(() =>
  import('@/features/expenses/pages/MoneyPage').then((m) => m.MoneyPage),
);
const ListsPage = lazyPage(() =>
  import('@/features/lists/pages/ListsPage').then((m) => m.ListsPage),
);
const ListDetailPage = lazyPage(() =>
  import('@/features/lists/pages/ListDetailPage').then((m) => m.ListDetailPage),
);
const SettingsPage = lazyPage(() =>
  import('@/features/settings/SettingsPage').then((m) => m.SettingsPage),
);

function SignedInRoutes({ userId }: { userId: string }) {
  return (
    <HouseholdGate userId={userId} onSignOut={() => void signOut()}>
      <AppShell>
        <Suspense fallback={<LoadingRows label="Loading page" />}>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/money" component={MoneyPage} />
            <Route path="/lists" component={ListsPage} />
            <Route path="/lists/:id" component={ListDetailPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route>
              <NotFound />
            </Route>
          </Switch>
        </Suspense>
      </AppShell>
    </HouseholdGate>
  );
}

function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <a href="/" className="mt-4 inline-block font-medium text-accent">
        Go home
      </a>
    </div>
  );
}

function AppRoutes() {
  const session = useSession();
  if (session.status === 'loading') {
    return <div className="min-h-dvh" aria-busy="true" />;
  }
  const isSignedIn = session.status === 'signed-in';
  return (
    <Switch>
      <Route path="/join">
        <JoinPage isSignedIn={isSignedIn} />
      </Route>
      {isSignedIn ? (
        <>
          <Route path="/sign-in">
            <Redirect to="/" replace />
          </Route>
          <Route path="/sign-up">
            <Redirect to="/" replace />
          </Route>
          <Route>
            <SignedInRoutes userId={session.userId} />
          </Route>
        </>
      ) : (
        <>
          <Route path="/sign-in" component={SignInPage} />
          <Route path="/sign-up" component={SignUpPage} />
          <Route>
            <Redirect to={readPendingInvite() ? '/sign-up' : '/sign-in'} replace />
          </Route>
        </>
      )}
    </Switch>
  );
}

function ConfigurationError({ missing }: { missing: string[] }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6">
      <h1 className="text-xl font-semibold">App is not configured</h1>
      <p className="text-ink-muted">
        Set these build-time variables (see <code>.env.example</code>) and rebuild:
      </p>
      <ul className="list-disc pl-5 font-mono text-sm">
        {missing.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </main>
  );
}

export function App() {
  if (!envResult.ok) return <ConfigurationError missing={envResult.missing} />;
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SessionProvider>
          <AppRoutes />
        </SessionProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
