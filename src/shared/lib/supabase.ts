import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { parseEnv } from './env';

export type AppSupabaseClient = SupabaseClient<Database>;

export const envResult = parseEnv(import.meta.env);

/**
 * The single Supabase client for the app. `null` when configuration is missing; the app shell
 * renders a configuration screen in that case instead of crashing.
 */
export const supabase: AppSupabaseClient | null = envResult.ok
  ? createClient<Database>(envResult.env.supabaseUrl, envResult.env.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/** For data adapters: they only run inside the configured app, so a missing client is a bug. */
export function getSupabase(): AppSupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}
