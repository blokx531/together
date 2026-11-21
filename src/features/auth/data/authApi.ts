import type { Session } from '@supabase/supabase-js';
import { toAppError, type AppError } from '@/shared/lib/appError';
import { getSupabase } from '@/shared/lib/supabase';

export type SignUpOutcome = 'signed-in' | 'confirmation-required';

function rethrow(error: unknown): never {
  throw toAppError(error);
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) rethrow(error);
}

export async function signUpWithPassword(
  email: string,
  password: string,
  displayName: string,
): Promise<SignUpOutcome> {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName }, emailRedirectTo: window.location.origin },
  });
  if (error) rethrow(error);
  // With "Confirm email" enabled Supabase returns a user without a session.
  return data.session ? 'signed-in' : 'confirmation-required';
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) rethrow(error);
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) rethrow(error);
}

export async function getInitialSession(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) rethrow(error);
  return data.session;
}

export function onSessionChange(listener: (session: Session | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
    listener(session);
  });
  return () => {
    data.subscription.unsubscribe();
  };
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'That email and password do not match.',
  user_already_exists: 'An account with this email already exists. Try signing in.',
  weak_password: 'Choose a stronger password (at least 8 characters).',
  email_address_invalid: 'Enter a valid email address.',
  signup_disabled: 'New sign-ups are closed for this app.',
  email_not_confirmed: 'Confirm your email address first, then sign in.',
  over_request_rate_limit: 'Too many attempts. Wait a minute and try again.',
  over_email_send_rate_limit: 'Too many emails were sent. Wait a while and try again.',
  same_password: 'The new password must be different from the current one.',
};

export function describeAuthError(error: AppError): string {
  return (error.code ? AUTH_MESSAGES[error.code] : undefined) ?? error.message;
}
