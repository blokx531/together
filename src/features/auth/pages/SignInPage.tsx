import { useState, type SubmitEvent } from 'react';
import { Link } from 'wouter';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { Button } from '@/shared/ui/Button';
import { FormError, TextField } from '@/shared/ui/Field';
import { describeAuthError, signInWithPassword } from '../data/authApi';
import { AuthLayout } from './AuthLayout';

export function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useAsyncAction(signInWithPassword);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void signIn.run(email.trim(), password);
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your shared space.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate={false}>
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
        <FormError message={signIn.error ? describeAuthError(signIn.error) : null} />
        <Button type="submit" isLoading={signIn.isPending} fullWidth>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        New here?{' '}
        <Link
          href="/sign-up"
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
