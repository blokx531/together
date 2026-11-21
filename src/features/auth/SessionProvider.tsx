import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { getInitialSession, onSessionChange } from './data/authApi';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; userId: string; email: string | null };

const SessionContext = createContext<SessionState>({ status: 'loading' });

function toState(session: Session | null): SessionState {
  if (!session) return { status: 'signed-out' };
  return { status: 'signed-in', userId: session.user.id, email: session.user.email ?? null };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let isActive = true;
    getInitialSession().then(
      (session) => {
        if (isActive) setState(toState(session));
      },
      () => {
        // A corrupt or expired stored session is treated as signed out.
        if (isActive) setState({ status: 'signed-out' });
      },
    );
    const unsubscribe = onSessionChange((session) => {
      // Ignore token refreshes for the same user to avoid re-rendering the whole app.
      setState((current) => {
        const next = toState(session);
        if (
          current.status === 'signed-in' &&
          next.status === 'signed-in' &&
          current.userId === next.userId
        ) {
          return current;
        }
        return next;
      });
    });
    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  return <SessionContext value={state}>{children}</SessionContext>;
}

export function useSession(): SessionState {
  return use(SessionContext);
}
