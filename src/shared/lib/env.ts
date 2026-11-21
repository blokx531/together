export interface AppEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

export type EnvResult = { ok: true; env: AppEnv } | { ok: false; missing: string[] };

const MIN_KEY_LENGTH = 20;

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Validates build-time configuration. Only public values belong here (they ship to browsers).
 * Hand-written rather than a schema library to keep the startup bundle small: it checks two fields.
 */
export function parseEnv(source: Record<string, unknown>): EnvResult {
  const url = source.VITE_SUPABASE_URL;
  const key = source.VITE_SUPABASE_PUBLISHABLE_KEY;
  const missing: string[] = [];
  if (!isHttpUrl(url)) missing.push('VITE_SUPABASE_URL');
  if (typeof key !== 'string' || key.length < MIN_KEY_LENGTH)
    missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (missing.length > 0 || !isHttpUrl(url) || typeof key !== 'string')
    return { ok: false, missing };
  return { ok: true, env: { supabaseUrl: url, supabasePublishableKey: key } };
}
