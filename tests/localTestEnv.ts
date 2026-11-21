import { parseEnv } from '../src/shared/lib/env';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function assertLocalTestUrl(
  value: string,
  variable: string,
  protocols: readonly string[],
): void {
  const url = URL.canParse(value) ? new URL(value) : null;
  if (!url || !LOOPBACK_HOSTS.has(url.hostname) || !protocols.includes(url.protocol)) {
    throw new Error(`${variable} must point to the disposable local Supabase stack.`);
  }
}

export function e2eBackendEnv(env: Record<string, unknown>): Record<string, string> {
  const result = parseEnv(env);
  if (!result.ok) {
    throw new Error(
      `Configure the local Supabase stack before running E2E: ${result.missing.join(', ')}.`,
    );
  }
  const { supabaseUrl, supabasePublishableKey } = result.env;
  assertLocalTestUrl(supabaseUrl, 'VITE_SUPABASE_URL', ['http:', 'https:']);
  return { VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey };
}
