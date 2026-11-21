import { useState, type SubmitEvent } from 'react';
import { Link } from 'wouter';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Button } from '@/shared/ui/Button';
import { FormError, TextField } from '@/shared/ui/Field';
import { describeAuthError, signUpWithPassword } from '../data/authApi';
import { AuthLayout } from './AuthLayout';

const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 40;

export function SignUpPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const signUp = useAsyncAction(signUpWithPassword);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = displayName.trim();
    if (name.length === 0) {
      setValidationError('Tell us what to call you.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setValidationError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      return;
    }
    setValidationError(null);
    const result = await signUp.run(email.trim(), password, name);
    if (result?.ok && result.value === 'confirmation-required') setNeedsConfirmation(true);
  };

  if (needsConfirmation) {
    return (
      <AuthLayout title="Check your email" subtitle={`We sent a confirmation link to ${email}.`}>
        <p className="text-sm text-ink-muted">
          Open the link on this device, then come back and sign in.
        </p>
        <Link href="/sign-in" className="mt-6 font-medium text-accent">
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="One account each. Your partner joins with an invite link."
    >
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
        <TextField
          label="Your name"
          autoComplete="given-name"
          required
          maxLength={MAX_NAME_LENGTH}
          hint="Shown to your partner. You can change it later."
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
          }}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
        <FormError
          message={validationError ?? (signUp.error ? describeAuthError(signUp.error) : null)}
        />
        <Button type="submit" isLoading={signUp.isPending} fullWidth>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link
          href="/sign-in"
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
