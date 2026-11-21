import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { readTokenFromHash, savePendingInvite } from '../pendingInvite';

interface JoinPageProps {
  isSignedIn: boolean;
}

/**
 * Entry point for invite links. Stores the token for this tab and continues to sign-up (or to the
 * app, whose onboarding screen shows the invitation once the user is signed in).
 */
export function JoinPage({ isSignedIn }: JoinPageProps) {
  const [, navigate] = useLocation();

  useEffect(() => {
    const token = readTokenFromHash(window.location.hash);
    if (token) savePendingInvite(token);
    // Drop the token from the address bar and history.
    navigate(isSignedIn ? '/' : '/sign-up', { replace: true });
  }, [isSignedIn, navigate]);

  return <p className="p-6 text-center text-ink-muted">Opening invite…</p>;
}
