import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('accepts a URL and publishable key', () => {
    expect(
      parseEnv({
        VITE_SUPABASE_URL: 'https://abc.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1234567890',
      }),
    ).toEqual({
      ok: true,
      env: {
        supabaseUrl: 'https://abc.supabase.co',
        supabasePublishableKey: 'sb_publishable_1234567890',
      },
    });
  });

  it('lists every missing or invalid variable', () => {
    expect(parseEnv({ VITE_SUPABASE_URL: 'not a url' })).toEqual({
      ok: false,
      missing: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'],
    });
    expect(
      parseEnv({
        VITE_SUPABASE_URL: 'javascript:alert(1)',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(30),
      }),
    ).toEqual({
      ok: false,
      missing: ['VITE_SUPABASE_URL'],
    });
  });
});
